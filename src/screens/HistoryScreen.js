import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getScanHistory, clearHistory, deleteHistoryItem, decrementLocalSequence, getLocalSequence } from '../utils/storage';
import { deleteFromSheet } from '../utils/api';
import { AuthContext } from '../context/AuthContext';

export default function HistoryScreen({ navigation }) {
    const [history, setHistory] = useState([]);
    const { user } = React.useContext(AuthContext);

    // Roles
    const role = user?.role?.toLowerCase() || 'auxiliar';
    const canEdit = ['administrador', 'supervisor', 'verificador'].includes(role);
    const canClearAll = role === 'administrador'; 
    // All can delete single items per user request

    useFocusEffect(
        useCallback(() => {
            loadHistory();
        }, [])
    );

    const loadHistory = async () => {
        const data = await getScanHistory();
        setHistory(data);
    };

    const handleClear = async () => {
        Alert.alert(
            "Limpiar Historial",
            "¿Estás seguro de que deseas borrar todo?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Borrar", 
                    style: "destructive", 
                    onPress: async () => {
                        await clearHistory();
                        loadHistory();
                    }
                }
            ]
        );
    };

    // State to lock delete actions (Debounce/Lock)
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (id) => {
        if (isDeleting) return; // Prevent double tap / rapid fire
        setIsDeleting(true);

        try {
            // Find item to delete
            const item = history.find(i => i.id === id);
            if (item && item.data && item.data.Batch) {
                 // 1. Delete from Sheet (Background) - Fire and forget
                 deleteFromSheet(item.data.Batch, item.data.Grade).catch(err => console.error("Background delete failed", err));

                // 2. Smart Decrement Logic
                if (item.data.Grade && item.data.Date) {
                     try {
                        const [y, m, d] = item.data.Date.split('-').map(Number);
                        const dateObj = new Date(y, m - 1, d);
                        const yLocal = dateObj.getFullYear().toString().slice(-2);
                        const mLocal = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                        const dLocal = dateObj.getDate().toString().padStart(2, '0');
                        const localDateStr = `${yLocal}${mLocal}${dLocal}`;
                        const storageKey = `${localDateStr}_${item.data.Grade}`;

                        const currentMax = await getLocalSequence(storageKey);
                        
                        const parts = item.data.Batch.split('I');
                        if (parts.length === 2) {
                            const seqInBatch = parseInt(parts[1]);
                            if (seqInBatch === currentMax) {
                                await decrementLocalSequence(storageKey);
                            }
                        }
                    } catch (e) {
                        console.error("Error adjusting sequence:", e);
                    }
                }
            }

            await deleteHistoryItem(id);
            await loadHistory(); // Await load to ensure UI sync
        } catch (e) {
            console.error("Delete error:", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const renderItem = ({ item }) => {
        const date = new Date(item.timestamp).toLocaleString();
        
        let content = null;
        if (item.data && typeof item.data === 'object') {
            content = Object.entries(item.data).map(([k, v]) => (
                <Text key={k} style={styles.itemText}><Text style={styles.bold}>{k}:</Text> {v}</Text>
            ));
        } else {
            content = <Text style={styles.itemText}>{String(item.data)}</Text>;
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.date}>{date}</Text>
                    <View style={{flexDirection: 'row'}}>
                        {canEdit && (
                             <TouchableOpacity onPress={() => navigation.navigate('Manual', { isEditing: true, item: item.data })} style={styles.editBtn}>
                                <Text style={styles.editText}>✎</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                            <Text style={styles.deleteText}>✖</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.cardContent}>
                    {content}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Historial</Text>
                {canClearAll && (
                    <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                        <Text style={styles.clearText}>Limpiar</Text>
                    </TouchableOpacity>
                )}
            </View>

            {history.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No hay registros.</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E5E5E5', // Grey
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        backgroundColor: '#111', // Black
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F',
    },
    backButton: {
        padding: 5,
    },
    backText: {
        fontSize: 16,
        color: '#DDD', // Light
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF', // White Title
    },
    clearButton: {
        padding: 5,
    },
    clearText: {
        color: '#D32F2F', // Red Text
        fontSize: 16,
        fontWeight: 'bold',
    },
    list: {
        padding: 15,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#333' // Dark Accent
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 5,
    },
    date: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold'
    },
    deleteBtn: {
        paddingHorizontal: 8,
    },
    deleteText: {
        color: '#D32F2F',
        fontSize: 16,
    },
    editBtn: {
        paddingHorizontal: 8,
        marginRight: 5
    },
    editText: {
        color: '#FBC02D', // Yellow for edit
        fontSize: 16,
    },
    cardContent: {
        gap: 2,
    },
    itemText: {
        fontSize: 14,
        color: '#333',
    },
    bold: {
        fontWeight: 'bold',
        color: '#000'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    }
});
