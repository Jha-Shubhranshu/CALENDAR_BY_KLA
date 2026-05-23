import { configureStore } from '@reduxjs/toolkit'

export const store = configureStore({
    reducer: {
        // Placeholder reducer to satisfy Redux Toolkit requirements
        auth: (state = {}) => state,
    },
})