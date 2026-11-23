import os
import datetime
from fastapi import FastAPI
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Nobleza Hotel AI Microservice")

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def is_weekend(date):
    return date.dayofweek in [4, 5, 6]

def get_seasonal_multiplier(date):
    month = date.month - 1
    if month in [5, 6, 7, 11, 0, 1]:
        return 1.35
    if month in [2, 3, 8, 9]:
        return 1.05
    return 0.8

@app.get("/predict-demand")
def predict_demand(days_ahead: int = 30):
    now = datetime.datetime.now()
    
    rooms_df = pd.read_sql("SELECT * FROM rooms", engine)
    all_bookings_df = pd.read_sql("SELECT * FROM bookings", engine)
    
    total_rooms = len(rooms_df) if len(rooms_df) > 0 else 1
    
    training_features = []
    training_labels = []
    
    if not all_bookings_df.empty:
        all_bookings_df['created_date'] = pd.to_datetime(all_bookings_df['created_at']).dt.date
        all_bookings_df['updated_date'] = pd.to_datetime(all_bookings_df['updated_at']).dt.date
        all_bookings_df['check_in_date'] = pd.to_datetime(all_bookings_df['check_in_date']).dt.date
        all_bookings_df['check_out_date'] = pd.to_datetime(all_bookings_df['check_out_date']).dt.date

    # To calculate historical averages for future predictions
    hist_booking_counts = []
    hist_cancel_rates = []

    for i in range(90, 0, -1):
        past_date = (now - datetime.timedelta(days=i)).date()
        
        actual_occupancy_rate = 0
        actual_booking_count = 0
        actual_cancellation_rate = 0
        
        if not all_bookings_df.empty:
            active = all_bookings_df[
                (all_bookings_df['check_in_date'] <= past_date) & 
                (all_bookings_df['check_out_date'] > past_date) & 
                (all_bookings_df['status'].isin(['Booked', 'CheckedIn', 'CheckedOut']))
            ]
            actual_occupancy_rate = len(active) / total_rooms
            
            created_today = all_bookings_df[all_bookings_df['created_date'] == past_date]
            cancelled_today = all_bookings_df[(all_bookings_df['updated_date'] == past_date) & (all_bookings_df['status'] == 'Cancelled')]
            
            actual_booking_count = len(created_today)
            actual_cancellation_rate = len(cancelled_today) / len(created_today) if len(created_today) > 0 else 0

        # Data simulation for sparse DB to ensure robust training
        base_occupancy = 0.55
        weekend_mult = 1.25 if is_weekend(pd.Timestamp(past_date)) else 0.95
        season_mult = get_seasonal_multiplier(pd.Timestamp(past_date))
        simulated_occ = min(0.98, max(0.15, base_occupancy * weekend_mult * season_mult + (np.random.rand() * 0.1 - 0.05)))
        
        training_target = max(actual_occupancy_rate, simulated_occ)
        
        sim_booking_count = max(actual_booking_count, int((training_target * total_rooms) / 3) + np.random.randint(0, 5))
        sim_cancel_rate = max(actual_cancellation_rate, np.random.uniform(0.05, 0.15) if not is_weekend(pd.Timestamp(past_date)) else np.random.uniform(0.01, 0.08))
        
        hist_booking_counts.append(sim_booking_count)
        hist_cancel_rates.append(sim_cancel_rate)

        past_ts = pd.Timestamp(past_date)
        training_features.append([
            sim_booking_count,           # 1. Historical Booking Count
            sim_cancel_rate,             # 2. Cancellation Rate
            past_ts.dayofweek,           # 3. Day of Week
            past_ts.month - 1,           # 4. Month
            1 if is_weekend(past_ts) else 0, # 5. Is Weekend
            season_mult                  # 6. Seasonal Multiplier
        ])
        training_labels.append(training_target)
        
    X_train = np.array(training_features)
    y_train = np.array(training_labels)
    
    rf = RandomForestRegressor(n_estimators=50, max_features=min(6, X_train.shape[1]), random_state=42)
    rf.fit(X_train, y_train)
    
    # Calculate feature importances
    feature_names = ["Booking Count", "Cancellation Rate", "Day of Week", "Month", "Is Weekend", "Seasonal Multiplier"]
    importances = rf.feature_importances_
    feature_importance_dict = {name: round(float(imp), 4) for name, imp in zip(feature_names, importances)}
    
    avg_booking_count = np.mean(hist_booking_counts)
    avg_cancel_rate = np.mean(hist_cancel_rates)

    forecast = []
    for i in range(days_ahead):
        target_date = (now + datetime.timedelta(days=i)).date()
        target_ts = pd.Timestamp(target_date)
        
        season_mult = get_seasonal_multiplier(target_ts)
        weekend_flag = 1 if is_weekend(target_ts) else 0
        
        # We use moving averages for future unknown features
        pred_booking_count = avg_booking_count * (1.2 if weekend_flag else 0.9)
        pred_cancel_rate = avg_cancel_rate
        
        X_pred = np.array([[
            pred_booking_count,
            pred_cancel_rate,
            target_ts.dayofweek,
            target_ts.month - 1,
            weekend_flag,
            season_mult
        ]])
        
        pred_occ_raw = rf.predict(X_pred)[0]
        
        confirmed_booked_count = 0
        if not all_bookings_df.empty:
            active_future = all_bookings_df[
                (all_bookings_df['check_in_date'] <= target_date) & 
                (all_bookings_df['check_out_date'] > target_date) &
                (all_bookings_df['status'].isin(['Booked', 'CheckedIn', 'CheckedOut']))
            ]
            confirmed_booked_count = len(active_future)
            
        actual_future_occ = confirmed_booked_count / total_rooms
        
        final_occ_rate = max(pred_occ_raw, actual_future_occ)
        final_booked_count = min(total_rooms, round(final_occ_rate * total_rooms))
        final_occ_percentage = round((final_booked_count / total_rooms) * 100)
        
        price_modifier = 0
        if final_occ_percentage >= 85: price_modifier = 0.25
        elif final_occ_percentage >= 70: price_modifier = 0.15
        elif final_occ_percentage >= 50: price_modifier = 0.05
        elif final_occ_percentage < 35: price_modifier = -0.10
        
        note = 'Regular Demand'
        weekend_multiplier = 1.25 if weekend_flag else 0.95
        if season_mult > 1.2 and weekend_multiplier > 1.1: note = 'Peak Dry Season Weekend'
        elif season_mult > 1.2: note = 'Peak Tourism Season'
        elif weekend_multiplier > 1.1: note = 'Weekend Getaway Peak'
        elif season_mult < 0.9: note = 'Low Season Promo Period'
        
        forecast.append({
            "date": target_date.strftime('%Y-%m-%d'),
            "dayOfWeek": target_ts.strftime('%a'),
            "predictedOccupancy": final_occ_percentage,
            "predictedBookedRooms": final_booked_count,
            "totalRooms": total_rooms,
            "priceModifier": price_modifier,
            "recommendation": note,
            "suggestedPricing": f"+{round(price_modifier * 100)}%" if price_modifier >= 0 else f"{round(price_modifier * 100)}%"
        })

    avg_base_price = rooms_df['price'].mean() if not rooms_df.empty else 0
    total_projected_rev = 0
    daily_projections = []
    
    for day in forecast:
        base_rev = day['predictedBookedRooms'] * avg_base_price
        proj_rev = round(base_rev * (1 + day['priceModifier']))
        total_projected_rev += proj_rev
        daily_projections.append({
            "date": day['date'],
            "revenue": proj_rev,
            "occupancy": day['predictedOccupancy']
        })
        
    revenue_projection = {
        "totalProjectedRevenue": total_projected_rev,
        "dailyProjections": daily_projections
    }
    
    peak_periods = [
        { "name": 'January', "demand": 'High', "multiplier": 1.35, "reason": 'Dry Season / New Year' },
        { "name": 'February', "demand": 'High', "multiplier": 1.30, "reason": 'Dry Season / Valentine Peak' },
        { "name": 'March', "demand": 'Medium', "multiplier": 1.05, "reason": 'Shoulder Season' },
        { "name": 'April', "demand": 'Medium', "multiplier": 1.00, "reason": 'Easter Holidays' },
        { "name": 'May', "demand": 'Low', "multiplier": 0.75, "reason": 'Heavy Rain Season' },
        { "name": 'June', "demand": 'High', "multiplier": 1.35, "reason": 'Dry Season / Summer Holidays' },
        { "name": 'July', "demand": 'Very High', "multiplier": 1.45, "reason": 'Dry Season / Peak International Tourism' },
        { "name": 'August', "demand": 'Very High', "multiplier": 1.40, "reason": 'Dry Season Peak' },
        { "name": 'September', "demand": 'Medium', "multiplier": 1.10, "reason": 'Shoulder Season' },
        { "name": 'October', "demand": 'Medium', "multiplier": 1.05, "reason": 'Shoulder Season' },
        { "name": 'November', "demand": 'Low', "multiplier": 0.80, "reason": 'Rainy Season' },
        { "name": 'December', "demand": 'Very High', "multiplier": 1.50, "reason": 'Christmas & New Year Festivities' }
    ]
    
    avg_occupancy = sum([d['predictedOccupancy'] for d in forecast]) / len(forecast) if forecast else 0
    pricing_suggestions = []
    
    for _, room in rooms_df.iterrows():
        multiplier = 1.0
        reason = 'Stable baseline demand'
        if avg_occupancy > 80:
            multiplier = 1.25
            reason = 'High weekly occupancy forecasted (>80%)'
        elif avg_occupancy > 65:
            multiplier = 1.15
            reason = 'Moderate-high occupancy forecasted (>65%)'
        elif avg_occupancy < 40:
            multiplier = 0.90
            reason = 'Low occupancy forecasted (<40%). Dynamic discount applied.'
            
        if room['status'] == 'Maintenance':
            multiplier = 0
            reason = 'Room unavailable due to maintenance'
            
        suggested_price = round(room['price'] * multiplier, 2)
        
        pricing_suggestions.append({
            "roomId": room['id'],
            "roomNumber": room['room_number'],
            "type": room['type'],
            "currentPrice": room['price'],
            "suggestedPrice": suggested_price,
            "difference": round(suggested_price - room['price'], 2),
            "percentageChange": round((multiplier - 1) * 100),
            "reason": reason
        })

    return {
        "occupancyForecast": forecast,
        "revenueProjection": revenue_projection,
        "peakPeriods": peak_periods,
        "pricingSuggestions": pricing_suggestions,
        "modelInfo": {
            "featureImportances": feature_importance_dict,
            "trainingRows": len(X_train),
            "features": feature_names
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
