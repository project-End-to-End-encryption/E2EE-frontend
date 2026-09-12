import {request} from '../../../infrastructure/http/httpClient.js'

export const signupUser = ({email, password, reservationId }) =>
    request('/api/v1/auth/signup', {email, password, reservationId});

export const loginUser = ({email, password}) =>
    request('/api/v1/auth/login', {email, password});