const API_BASE_URL = 'https://saloon-brothers-backend.onrender.com/api';

export async function fetchBarbers() {
  const response = await fetch(`${API_BASE_URL}/barbers`);
  if (!response.ok) throw new Error('Berberler yüklenemedi.');
  return response.json();
}

export async function fetchServices() {
  const response = await fetch(`${API_BASE_URL}/services`);
  if (!response.ok) throw new Error('Hizmetler yüklenemedi.');
  return response.json();
}

export async function fetchSlots(barberId, date) {
  const response = await fetch(`${API_BASE_URL}/slots?barberId=${barberId}&date=${date}`);
  if (!response.ok) throw new Error('Saat dilimleri yüklenemedi.');
  return response.json();
}

export async function createAppointment(appointmentData) {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appointmentData),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Randevu oluşturulamadı.');
  }
  return response.json();
}

export async function fetchAppointments() {
  const response = await fetch(`${API_BASE_URL}/appointments`);
  if (!response.ok) throw new Error('Randevular yüklenemedi.');
  return response.json();
}

export async function deleteAppointment(id) {
  const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Randevu iptal edilemedi.');
  return response.json();
}

export async function updateAppointmentStatus(id, status) {
  const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error('Randevu durumu güncellenemedi.');
  return response.json();
}

// Expense Management API calls
export async function fetchExpenses() {
  const response = await fetch(`${API_BASE_URL}/expenses`);
  if (!response.ok) throw new Error('Giderler yüklenemedi.');
  return response.json();
}

export async function createExpense(expenseData) {
  const response = await fetch(`${API_BASE_URL}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Gider eklenemedi.');
  }
  return response.json();
}

export async function deleteExpense(id) {
  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Gider silinemedi.');
  return response.json();
}
