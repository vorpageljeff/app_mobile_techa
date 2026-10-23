import type * as Zustand from 'zustand';
import type * as ZustandMiddleware from 'zustand/middleware';

const zustand = require('zustand') as typeof Zustand;
const middleware = require('zustand/middleware') as typeof ZustandMiddleware;

export const { create } = zustand;
export const { createJSONStorage, persist } = middleware;
