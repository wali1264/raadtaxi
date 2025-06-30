export function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: number | undefined = undefined;
  return (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    clearTimeout(timeoutId);
    return new Promise<Awaited<ReturnType<F>>>((resolve, reject) => {
      timeoutId = window.setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      }, waitFor);
    });
  };
}

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

export function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Helper function to get a more descriptive error message for console logging
export const getDebugMessage = (err: any): string => {
  if (typeof err === 'string') return err;
  if (err) {
    let messageParts: string[] = [];
    if (err.message && typeof err.message === 'string' && err.message.trim() && err.message.toLowerCase() !== '[object object]') {
        messageParts.push(err.message);
    }
    if (err.details && typeof err.details === 'string' && err.details.trim()) {
        messageParts.push(`Details: ${err.details}`);
    }
    if (err.code && (typeof err.code === 'string' || typeof err.code === 'number')) {
        messageParts.push(`Code: ${err.code}`);
    }
    if (messageParts.length > 0) return messageParts.join('; ');

    if (typeof err.toString === 'function') {
        const errStr = err.toString();
        if (errStr.toLowerCase() !== '[object object]' && errStr.trim() !== '') {
            return errStr;
        }
    }
  }
  return 'The error object did not have a standard message, details, or code. See the full object logged next.';
};

/**
 * A robust promisified function to get the user's current location.
 * It checks for permissions using the Permissions API before making a request.
 *
 * @param {PositionOptions} [options] - Optional PositionOptions for the geolocation request.
 * @returns {Promise<GeolocationPosition>} A promise that resolves with the position or rejects with a GeolocationPositionError.
 */
export const getCurrentLocation = (
    options: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            // Create an error object that mimics GeolocationPositionError
            return reject({
                code: 2, // POSITION_UNAVAILABLE is the closest standard code
                message: 'Geolocation is not supported by this browser.',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
            } as GeolocationPositionError);
        }

        const getPosition = () => navigator.geolocation.getCurrentPosition(resolve, reject, options);

        // Use Permissions API if available for a proactive check
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
                if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt') {
                    getPosition();
                } else { // 'denied'
                    reject({
                        code: 1, // PERMISSION_DENIED
                        message: 'User denied the request for Geolocation.',
                        PERMISSION_DENIED: 1,
                        POSITION_UNAVAILABLE: 2,
                        TIMEOUT: 3,
                    } as GeolocationPositionError);
                }
            }).catch(err => {
                console.warn("Permissions API query failed, proceeding with direct request.", err);
                getPosition(); // Fallback if query itself fails
            });
        } else {
            // Fallback for browsers that don't support the Permissions API
            getPosition();
        }
    });
};