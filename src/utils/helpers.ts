
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
