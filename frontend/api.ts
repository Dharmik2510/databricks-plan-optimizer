
import { API } from '../backend/api';

// Frontend API Client
// In a real microservices architecture, this would use fetch() or axios
// pointing to the backend URL. For now, it maps to the backend controller directly.

export const client = API;
