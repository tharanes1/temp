import * as Location from 'expo-location';

export const geocodeService = {
  reverseGeocode: async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const { street, city, region, postalCode } = results[0];
        return `${street ? street + ', ' : ''}${city}, ${region} ${postalCode}`;
      }
      return 'Unknown Location';
    } catch (e) {
      console.error('Geocode Error:', e);
      return 'Error retrieving address';
    }
  },
  geocode: async (address: string) => {
    try {
      const results = await Location.geocodeAsync(address);
      return results;
    } catch (e) {
      console.error('Geocode Error:', e);
      return [];
    }
  }
};
