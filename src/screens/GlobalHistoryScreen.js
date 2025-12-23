import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPaginatedData, deleteFromSheet } from '../utils/api';

export default function GlobalHistoryScreen({ navigation }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1); // Estimated
    const [totalRows, setTotalRows] = useState(0);

    const pageSize = 100;

    useEffect(() => {
        loadPage(1);
    }, []);

    const loadPage = async (p) => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetchPaginatedData(p, pageSize);
            setData(res.data);
            setTotalRows(res.total);
            setPage(res.page);
            // Calculate total pages
            const pages = Math.ceil(res.total / pageSize);
            setTotalPages(Math.max(1, pages));
        } catch (e) {
            Alert.alert("Error", "No se pudo cargar la base de datos: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (page < totalPages) loadPage(page + 1);
    };

    const handlePrev = () => {
        if (page > 1) loadPage(page - 1);
    };

    const handleEdit = (item) => {
        // Navigate to Manual Screen in "Remote Edit Mode"
        // We pass 'isRemote: true' so ManualScreen knows to use updateRemoteRow
        navigation.navigate('Manual', { 
            isEditing: true, 
            isRemote: true,
            item: item 
        });
    };

    const handleDelete = (item) => {
         Alert.alert(
            "Borrar Registro",
            `¿Estás seguro de borrar el lote ${item.Batch}? Esto no se puede deshacer.`,
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Borrar", 
                    style: "destructive", 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await deleteFromSheet(item.Batch, item.Grade);
                            Alert.alert("Éxito", "Registro borrado");
                            loadPage(page); // Reload current page
                        } catch (e) {
                             Alert.alert("Error", "Falló el borrado: " + e.message);
                             setLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.batchId}>Lote: {item.Batch}</Text>
                <Text style={styles.date}>{item.Date || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
                <Text style={styles.label}>Grado:</Text>
                <Text style={styles.value}>{item.Grade}</Text>
                <Text style={styles.label}>SAE:</Text>
                <Text style={styles.value}>{item.SAE}</Text>
            </View>
            <View style={styles.row}>
                 <Text style={styles.label}>Peso:</Text>
                 <Text style={styles.value}>{item.Weight} kg</Text>
                 <Text style={styles.label}>Colada:</Text>
                 <Text style={styles.value}>{item.HeatNo}</Text>
            </View>
             <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.actionBtn, styles.editBtn]}>
                    <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
                    <Text style={styles.actionText}>Borrar</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
             <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Base de Datos Global</Text>
                <TouchableOpacity onPress={() => loadPage(page)} style={styles.reloadButton}>
                     <Text style={styles.reloadText}>↻</Text>
                </TouchableOpacity>
            </View>
            
            <View style={styles.summary}>
                <Text style={styles.summaryText}>Total: {totalRows} registros</Text>
                <Text style={styles.summaryText}>Página {page} de {totalPages}</Text>
            </View>

            {loading && <ActivityIndicator size="large" color="#9C27B0" style={{marginTop: 20}} />}

            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.Batch}_${item.Grade}_${index}`}
                contentContainerStyle={styles.list}
            />

            <View style={styles.footer}>
                <TouchableOpacity 
                    onPress={handlePrev} 
                    disabled={page <= 1 || loading}
                    style={[styles.navBtn, (page <= 1 || loading) && styles.disabled]}
                >
                    <Text style={styles.navText}>{"< Anterior"}</Text>
                </TouchableOpacity>
                
                <Text style={styles.pageIndicator}>{page}</Text>

                <TouchableOpacity 
                    onPress={handleNext} 
                    disabled={page >= totalPages || loading}
                    style={[styles.navBtn, (page >= totalPages || loading) && styles.disabled]}
                >
                    <Text style={styles.navText}>{"Siguiente >"}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#E5E5E5', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: 15, 
        backgroundColor: '#111', 
        elevation: 4,
        borderBottomWidth: 2,
        borderBottomColor: '#D32F2F'
    },
    backText: { color: '#DDD', fontSize: 16 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
    reloadButton: { padding: 5 },
    reloadText: { fontSize: 24, color: '#FFF' },
    summary: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#DDD', borderBottomWidth: 1, borderColor: '#BBB' },
    summaryText: { color: '#333', fontWeight: 'bold' },
    list: { padding: 10 },
    card: { 
        backgroundColor: 'white', 
        padding: 15, 
        marginBottom: 10, 
        borderRadius: 8, 
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#D32F2F' 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 5 },
    batchId: { fontWeight: 'bold', fontSize: 16, color: '#000' },
    date: { color: '#666', fontWeight: 'bold' },
    row: { flexDirection: 'row', marginBottom: 5 },
    label: { fontWeight: 'bold', width: 60, color: '#444' },
    value: { flex: 1, color: '#111' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 },
    actionBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 4, borderWidth: 1 },
    editBtn: { backgroundColor: '#FFF', borderColor: '#FBC02D' }, // White with Yellow border
    deleteBtn: { backgroundColor: '#FFF', borderColor: '#D32F2F' }, // White with Red border
    actionText: { color: '#333', fontWeight: 'bold', fontSize: 12 }, // Or specific colors for text
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#111', elevation: 5, borderTopWidth: 2, borderTopColor: '#D32F2F' },
    navBtn: { padding: 10, backgroundColor: '#333', borderRadius: 4, borderWidth: 1, borderColor: '#555' },
    disabled: { backgroundColor: '#222', opacity: 0.5 },
    navText: { color: 'white', fontWeight: 'bold' },
    pageIndicator: { fontSize: 18, fontWeight: 'bold', color: '#FFF' }
});
