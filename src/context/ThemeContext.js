import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../utils/theme';
import { StatusBar, Platform } from 'react-native';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(true); // Default dark
    const [colors, setColors] = useState(theme.dark);

    useEffect(() => {
        loadTheme();
    }, []);

    useEffect(() => {
        setColors(isDark ? theme.dark : theme.light);
        if (isDark) {
            StatusBar.setBarStyle('light-content');
            if (Platform.OS === 'android') StatusBar.setBackgroundColor('#000000');
        } else {
            StatusBar.setBarStyle('dark-content');
            if (Platform.OS === 'android') StatusBar.setBackgroundColor(theme.light.header);
        }
    }, [isDark]);

    const loadTheme = async () => {
        try {
            const savedTheme = await AsyncStorage.getItem('userData.theme');
            if (savedTheme !== null) {
                setIsDark(JSON.parse(savedTheme));
            }
        } catch (e) {
            console.log('Error loading theme:', e);
        }
    };

    const toggleTheme = async () => {
        const newMode = !isDark;
        setIsDark(newMode);
        try {
            await AsyncStorage.setItem('userData.theme', JSON.stringify(newMode));
        } catch (e) {
            console.log('Error saving theme:', e);
        }
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};
