import React, { createContext, useState, useEffect } from 'react'; // FIXED: Added React imports
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUsersFromScript } from '../utils/api'; // Ensure this is imported if used, logically it was there before

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // { name: "Juan", pin: "1234" }
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState(null); // New error state

    // ... (loadPersistedUser same)

    const refreshUsers = async () => {
        setLoadingUsers(true);
        setError(null);
        try {
            const users = await fetchUsersFromScript();
            setUserList(users);
            return users;
        } catch (e) {
            console.error("AuthContext refresh error:", e);
            setError(e.message || "Error desconocido al cargar usuarios");
            setUserList([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    const login = async (selectedUser, pin) => {
        if (!selectedUser) return false;
        
        if (String(selectedUser.pin) === String(pin)) {
            setUser(selectedUser);
            await AsyncStorage.setItem('auth_user', JSON.stringify(selectedUser));
            return true;
        }
        return false;
    };

    const logout = async () => {
        setUser(null);
        await AsyncStorage.removeItem('auth_user');
    };

    return (
        <AuthContext.Provider value={{ user, userList, loadingUsers, initializing, refreshUsers, login, logout, error }}>
            {children}
        </AuthContext.Provider>
    );
};
