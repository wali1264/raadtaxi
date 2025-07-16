// Timing and Thresholds
export const PASSENGER_REQUEST_TIMEOUT_MS = 90000; // 90 seconds
export const DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS = 30;
export const DRIVER_STATUS_POLLING_INTERVAL_MS = 10000; // Poll for new requests every 10 seconds
export const TRIP_STATUS_POLLING_INTERVAL_MS = 5000; // Poll for active trip status every 5 seconds

// Map and Geolocation
export const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters for arrival checks

// Fare Calculation
export const MINIMUM_FARE = 30; // Minimum fare in AFN for any trip
