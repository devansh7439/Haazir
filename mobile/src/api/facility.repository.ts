import { api } from './client';
import { FacilityListSchema, RatingsSchema } from './schema';

export const FacilityRepository = {
  /** The hospital directory with capabilities, contacts and call statistics. */
  list: () => api('/api/facilities', FacilityListSchema),

  /** Google star ratings by hospital id; empty unless the server has a Places key. */
  ratings: () => api('/api/facilities/ratings', RatingsSchema),
};
