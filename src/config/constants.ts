

// Timing and Thresholds
export const PASSENGER_REQUEST_TIMEOUT_MS = 90000; // 90 seconds
export const DRIVER_REQUEST_POPUP_TIMEOUT_SECONDS = 30;
export const DRIVER_STATUS_POLLING_INTERVAL_MS = 7000; // Poll for new requests
export const TRIP_STATUS_POLLING_INTERVAL_MS = 3000; // Poll for active trip status

// Map and Geolocation
export const PROXIMITY_THRESHOLD_KM = 0.1; // 100 meters for arrival checks

// Fare Calculation
export const MINIMUM_FARE = 30; // Minimum fare in AFN for any trip