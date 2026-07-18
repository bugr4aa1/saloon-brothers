import React, { useState, useEffect } from 'react';
import { 
  Scissors, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Star, 
  Trash2, 
  Check, 
  Award, 
  ShieldCheck,
  Lock,
  LogOut,
  Bell,
  X,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PlusCircle
} from 'lucide-react';
import * as Api from './API';

// Web Audio API Synthesizer Beep for Real-time alerts
function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Play a repeating loud double-beep sawtooth sequence every second for 10 seconds
    const totalBeeps = 10;
    const beepDuration = 0.35; 
    
    for (let i = 0; i < totalBeeps; i++) {
      const secondStart = now + i;
      
      // Beep 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sawtooth'; // sawtooth waveform is much louder and buzzy like a real alarm
      osc1.frequency.setValueAtTime(988, secondStart); // high piercing B5 pitch
      gain1.gain.setValueAtTime(0.35, secondStart); // high volume
      gain1.gain.exponentialRampToValueAtTime(0.001, secondStart + beepDuration);
      osc1.start(secondStart);
      osc1.stop(secondStart + beepDuration);

      // Beep 2 (quick succession for alarm warning)
      const beep2Start = secondStart + 0.4;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(988, beep2Start);
      gain2.gain.setValueAtTime(0.35, beep2Start);
      gain2.gain.exponentialRampToValueAtTime(0.001, beep2Start + beepDuration);
      osc2.start(beep2Start);
      osc2.stop(beep2Start + beepDuration);
    }
  } catch (err) {
    console.log('Audio Context interaction block or error:', err);
  }
}


function App() {
  const [activeTab, setActiveTab] = useState('home'); // home, book, admin
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Branch selection state (1 = 1. Şube, 2 = 2. Şube)
  const [selectedBranch, setSelectedBranch] = useState(1);

  // Authentication States
  const [loggedInUser, setLoggedInUser] = useState(() => {
    try {
      const stored = localStorage.getItem('loggedInUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [adminUsernameInput, setAdminUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const isAdminAuthenticated = !!loggedInUser;


  // Toast Notifications State
  const [toasts, setToasts] = useState([]);

  // Custom Modal States
  const [modal, setModal] = useState({
    isOpen: false,
    type: 'alert', // alert, confirm
    severity: 'info', // info, success, warning, danger
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  // Payment and Veresiye custom modal states
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, appointmentId: null, onSelect: null });
  const [veresiyeDetailModal, setVeresiyeDetailModal] = useState({ isOpen: false, customerPhone: null, customerName: null });
  const [tahsilatModal, setTahsilatModal] = useState({ isOpen: false, customerPhone: null, customerName: null, totalDebt: 0 });
  const [tahsilatAmountInput, setTahsilatAmountInput] = useState('');
  const [tahsilatPaymentMethod, setTahsilatPaymentMethod] = useState('Nakit');

  // Admin Tab & Sub-tab filter states
  const [adminSubTab, setAdminSubTab] = useState('appointments'); // appointments, finance
  const [adminFilter, setAdminFilter] = useState('Beklemede'); // Beklemede, Onaylandı, Tamamlandı, Veresiye, Tamamlanmadı, Tümü

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'Kira', // Kira, Malzeme, Fatura, Maaş, Diğer
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Booking Flow States
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Custom Modal helper methods
  const showAlert = (title, message, severity = 'info') => {
    setModal({
      isOpen: true,
      type: 'alert',
      severity,
      title,
      message,
      onConfirm: () => setModal(prev => ({ ...prev, isOpen: false })),
      onCancel: null
    });
  };

  const showConfirm = (title, message, onConfirm, severity = 'warning') => {
    setModal({
      isOpen: true,
      type: 'confirm',
      severity,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setModal(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // WebSocket Connection with Auto-reconnect for Real-time Notifications
  useEffect(() => {
    const wsBase = Api.API_BASE_URL.replace('/api', '');
    const wsProtocol = wsBase.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = wsBase.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}//${wsHost}`;

    let socket = null;
    let reconnectTimeout = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      console.log('Connecting WebSocket to:', wsUrl);
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket Connected to backend successfully');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_APPOINTMENT') {
            const app = data.appointment;
            
            // Play alert sound
            playNotificationSound();

            // Push toast notification
            const newToast = {
              id: Date.now().toString(),
              title: 'Yeni Randevu Talebi!',
              body: `${app.customerName}, ${app.date} günü saat ${app.time} için randevu talep etti.`,
              meta: `Tutar: ${app.totalPrice} TL | Berber: ${app.barberName}`
            };

            setToasts(prevToasts => [newToast, ...prevToasts]);

            // Automatically reload dashboard data
            loadAdminDashboardData();
          }
        } catch (err) {
          console.error('Error handling WS message:', err);
        }
      };

      socket.onclose = (e) => {
        console.log('WebSocket connection closed. Reconnecting in 3 seconds...', e);
        if (isMounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [activeTab]);

  // Handle toast removal after delay
  const removeToast = (id) => {
    setToasts(prevToasts => prevToasts.filter(t => t.id !== id));
  };

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const barbersData = await Api.fetchBarbers();
        const servicesData = await Api.fetchServices();
        setBarbers(barbersData);
        setServices(servicesData);
      } catch (err) {
        setError('Veriler yüklenirken hata oluştu. Sunucunun çalıştığından emin olun.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch slots when barber or date changes
  useEffect(() => {
    if (selectedBarber && selectedDate) {
      async function loadSlots() {
        try {
          const slotsData = await Api.fetchSlots(selectedBarber.id, selectedDate);
          setSlots(slotsData);
        } catch (err) {
          console.error('Saatler yüklenirken hata oluştu:', err);
        }
      }
      loadSlots();
    }
  }, [selectedBarber, selectedDate]);

  // Load appointments and expenses for admin panel
  useEffect(() => {
    if (activeTab === 'admin' && isAdminAuthenticated) {
      loadAdminDashboardData();
    }
  }, [activeTab, isAdminAuthenticated]);

  async function loadAdminDashboardData() {
    setLoading(true);
    try {
      const appointmentsData = await Api.fetchAppointments();
      const expensesData = await Api.fetchExpenses();
      setAppointments(appointmentsData);
      setExpenses(expensesData);
    } catch (err) {
      console.error('Veriler yüklenirken hata oluştu:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppointments() {
    try {
      const data = await Api.fetchAppointments();
      setAppointments(data);
    } catch (err) {
      console.error(err);
    }
  }

  // Handle Admin Authentication
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const result = await Api.login(adminUsernameInput, passwordInput);
      if (result.success) {
        setLoggedInUser(result.user);
        localStorage.setItem('loggedInUser', JSON.stringify(result.user));
        setAdminUsernameInput('');
        setPasswordInput('');
        showAlert('Giriş Başarılı', `Hoş geldiniz, ${result.user.name}`, 'success');

        // Force unlock browser Audio Context to allow loud alarms
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const tempCtx = new AudioContext();
            if (tempCtx.state === 'suspended') {
              tempCtx.resume();
            }
          }
        } catch (err) {
          console.log('Audio unlock failed:', err);
        }
      }
    } catch (err) {
      setLoginError(err.message || 'Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setLoggedInUser(null);
    localStorage.removeItem('loggedInUser');
    setActiveTab('home');
    showAlert('Çıkış Yapıldı', 'Oturumunuz sonlandırıldı.', 'info');
  };

  // Update appointment status (Approve, Reject, Complete, Veresiye, Tamamlanmadı)
  const handleUpdateStatus = (id, status) => {
    if (status === 'Tamamlandı') {
      setPaymentModal({
        isOpen: true,
        appointmentId: id,
        onSelect: async (method) => {
          setPaymentModal({ isOpen: false, appointmentId: null, onSelect: null });
          setLoading(true);
          try {
            const result = await Api.updateAppointmentStatus(id, 'Tamamlandı', method);
            if (result.success) {
              showAlert('Başarılı', `Ödeme '${method}' olarak tahsil edildi ve randevu tamamlandı.`, 'success');
              loadAdminDashboardData();
            }
          } catch (err) {
            showAlert('Hata', 'Randevu durumu güncellenirken hata oluştu.', 'danger');
          } finally {
            setLoading(false);
          }
        }
      });
      return;
    }

    let actionText = '';
    let severity = 'warning';
    
    if (status === 'Onaylandı') {
      actionText = 'onaylamak';
      severity = 'success';
    } else if (status === 'İptal Edildi') {
      actionText = 'iptal etmek';
      severity = 'danger';
    } else if (status === 'Veresiye') {
      actionText = 'veresiye (borçlu alacak) olarak kaydetmek';
      severity = 'warning';
    } else if (status === 'Tamamlanmadı') {
      actionText = 'gelmedi / tamamlanmadı olarak işaretlemek';
      severity = 'danger';
    }

    showConfirm(
      'Randevu Durumu Güncelleme',
      `Bu randevuyu ${actionText} istediğinizden emin misiniz?`,
      async () => {
        try {
          const result = await Api.updateAppointmentStatus(id, status);
          if (result.success) {
            showAlert('Başarılı', `Randevu durumu '${status}' olarak güncellendi.`, 'success');
            loadAdminDashboardData();
          }
        } catch (err) {
          showAlert('Hata', 'Randevu durumu güncellenirken hata oluştu.', 'danger');
        }
      },
      severity
    );
  };

  const handleTahsilatSubmit = async (e) => {
    e.preventDefault();
    if (!tahsilatAmountInput || parseInt(tahsilatAmountInput) <= 0) {
      showAlert('Eksik Bilgi', 'Lütfen geçerli bir ödeme tutarı girin.', 'warning');
      return;
    }
    if (parseInt(tahsilatAmountInput) > tahsilatModal.totalDebt) {
      showAlert('Geçersiz Tutar', 'Ödenen tutar kalan toplam borçtan fazla olamaz.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await Api.payVeresiyeDebt(
        tahsilatModal.customerPhone,
        parseInt(tahsilatAmountInput),
        tahsilatPaymentMethod
      );
      if (result.success) {
        setTahsilatModal({ isOpen: false, customerPhone: null, customerName: null, totalDebt: 0 });
        setTahsilatAmountInput('');
        showAlert('Başarılı', 'Tahsilat yapıldı ve girilen tutar veresiye borcundan düşüldü.', 'success');
        loadAdminDashboardData();
      }
    } catch (err) {
      showAlert('Hata', err.message || 'Tahsilat yapılırken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const getGroupedVeresiyeler = () => {
    const grouped = {};
    const veresiyes = userAppointments.filter(app => app.status === 'Veresiye');
    
    veresiyes.forEach(app => {
      const key = app.customerPhone;
      if (!grouped[key]) {
        grouped[key] = {
          customerName: app.customerName,
          customerPhone: app.customerPhone,
          totalDebt: 0,
          appointments: []
        };
      }
      grouped[key].totalDebt += app.totalPrice;
      grouped[key].appointments.push(app);
    });
    
    return Object.values(grouped);
  };

  // Completely delete/cancel appointment
  const handleCancelAppointment = (id) => {
    showConfirm(
      'Randevuyu Sil',
      'Bu randevu kaydını sistemden tamamen silmek istediğinizden emin misiniz?',
      async () => {
        try {
          const result = await Api.deleteAppointment(id);
          if (result.success) {
            showAlert('Başarılı', 'Randevu kaydı silindi.', 'success');
            loadAdminDashboardData();
          }
        } catch (err) {
          showAlert('Hata', 'Randevu silinirken bir hata oluştu.', 'danger');
        }
      },
      'danger'
    );
  };

  // Handle Expense Submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.amount || !expenseForm.category || !expenseForm.date) {
      showAlert('Eksik Bilgi', 'Lütfen tüm zorunlu alanları doldurun.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const result = await Api.createExpense(expenseForm);
      if (result.success) {
        showAlert('Başarılı', 'Gider başarıyla eklendi.', 'success');
        setExpenseForm({
          title: '',
          amount: '',
          category: 'Kira',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        loadAdminDashboardData();
      }
    } catch (err) {
      showAlert('Hata', err.message || 'Gider eklenirken bir hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Handle Expense Delete
  const handleDeleteExpense = (id) => {
    showConfirm(
      'Gideri Sil',
      'Bu gider kaydını tamamen silmek istediğinizden emin misiniz?',
      async () => {
        try {
          const result = await Api.deleteExpense(id);
          if (result.success) {
            showAlert('Başarılı', 'Gider kaydı silindi.', 'success');
            loadAdminDashboardData();
          }
        } catch (err) {
          showAlert('Hata', 'Gider silinirken bir hata oluştu.', 'danger');
        }
      },
      'danger'
    );
  };

  // Handle service selection (multi-select)
  const toggleService = (service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  // Helper calculations
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  // Financial dashboard calculations
  const totalRevenue = (loggedInUser?.role === 'barber'
    ? appointments.filter(app => app.barberId === loggedInUser.barberId)
    : appointments)
    .filter(app => app.status === 'Tamamlandı')
    .reduce((sum, app) => sum + app.totalPrice, 0);

  const totalVeresiye = (loggedInUser?.role === 'barber'
    ? appointments.filter(app => app.barberId === loggedInUser.barberId)
    : appointments)
    .filter(app => app.status === 'Veresiye')
    .reduce((sum, app) => sum + app.totalPrice, 0);

  const totalExpense = loggedInUser?.role === 'barber' ? 0 : expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netProfit = totalRevenue - totalExpense; // Cash on hand profit (Revenue - Expenses)


  // Get next 7 working days (excluding Sundays) for booking
  const getNextSevenDays = () => {
    const days = [];
    const today = new Date();
    let added = 0;
    let offset = 0;
    while (added < 7) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      
      // 0 is Sunday
      if (date.getDay() !== 0) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        
        const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
        const dayNum = date.getDate();
        
        days.push({
          formatted: `${yyyy}-${mm}-${dd}`,
          dayName,
          dayNum
        });
        added++;
      }
      offset++;
    }
    return days;
  };


  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBarber || selectedServices.length === 0 || !selectedDate || !selectedTime) {
      showAlert('Eksik Bilgi', 'Eksik seçimler var, lütfen kontrol edin.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        barberId: selectedBarber.id,
        services: selectedServices.map(s => s.id),
        date: selectedDate,
        time: selectedTime,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        notes: customerInfo.notes
      };

      const result = await Api.createAppointment(payload);
      if (result.success) {
        setBookingSuccess(result.appointment);
        setBookingStep(5); // Success step
      }
    } catch (err) {
      showAlert('Hata', err.message || 'Randevu alınırken hata oluştu.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Reset booking form
  const resetBooking = () => {
    setBookingStep(1);
    setSelectedBarber(null);
    setSelectedServices([]);
    setSelectedDate('');
    setSelectedTime('');
    setCustomerInfo({ name: '', phone: '', email: '', notes: '' });
    setBookingSuccess(null);
    setActiveTab('home');
  };

  // Filter appointments according to user access role
  const userAppointments = loggedInUser?.role === 'barber'
    ? appointments.filter(app => app.barberId === loggedInUser.barberId)
    : appointments;

  // Filter appointments for admin view table
  const filteredAppointments = userAppointments.filter(app => {
    if (adminFilter === 'Tümü') return true;
    return app.status === adminFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => {
          setTimeout(() => removeToast(toast.id), 6000);
          return (
            <div key={toast.id} className="toast">
              <button className="toast-close" onClick={() => removeToast(toast.id)}>
                <X size={16} />
              </button>
              <div className="toast-title">
                <Bell size={16} />
                {toast.title}
              </div>
              <div className="toast-body">{toast.body}</div>
              {toast.meta && <div className="toast-meta">{toast.meta}</div>}
            </div>
          );
        })}
      </div>

      {/* Custom Modal overlay popup */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={modal.onCancel || modal.onConfirm}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className={`modal-header ${modal.severity}`}>
              {modal.severity === 'danger' && <AlertTriangle size={24} />}
              {modal.severity === 'success' && <CheckCircle2 size={24} />}
              {modal.severity === 'warning' && <AlertTriangle size={24} />}
              {modal.severity === 'info' && <Bell size={24} />}
              <h3>{modal.title}</h3>
            </div>
            <div className="modal-body">
              {modal.message}
            </div>
            <div className="modal-actions">
              {modal.type === 'confirm' && (
                <>
                  <button className="btn btn-secondary" onClick={modal.onCancel}>
                    Vazgeç
                  </button>
                  <button 
                    className={`btn ${modal.severity === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                    onClick={modal.onConfirm}
                    style={modal.severity === 'success' ? { backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' } : {}}
                  >
                    Onayla
                  </button>
                </>
              )}
              {modal.type === 'alert' && (
                <button className="btn btn-primary" onClick={modal.onConfirm}>
                  Tamam
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ödeme Yöntemi Seçici Modal */}
      {paymentModal.isOpen && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ isOpen: false, appointmentId: null, onSelect: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <DollarSign size={24} />
              <h3>Ödeme Yöntemi Seçin</h3>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Lütfen bu işlem için kullanılacak ödeme yöntemini seçin:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button 
                  className="btn btn-primary" 
                  style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff', fontSize: '1rem', padding: '0.75rem' }}
                  onClick={() => paymentModal.onSelect('Nakit')}
                >
                  💵 Nakit Ödeme
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', color: '#fff', fontSize: '1rem', padding: '0.75rem' }}
                  onClick={() => paymentModal.onSelect('Kart')}
                >
                  💳 Kredi / Banka Kartı
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff', fontSize: '1rem', padding: '0.75rem' }}
                  onClick={() => paymentModal.onSelect('IBAN')}
                >
                  🏦 IBAN / Havale Transferi
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setPaymentModal({ isOpen: false, appointmentId: null, onSelect: null })}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Veresiye Detay Geçmişi Modalı */}
      {veresiyeDetailModal.isOpen && (
        <div className="modal-overlay" onClick={() => setVeresiyeDetailModal({ isOpen: false, customerPhone: null, customerName: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
            <div className="modal-header info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <Bell size={24} />
              <h3>{veresiyeDetailModal.customerName} - Veresiye Detayları</h3>
            </div>
            <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto', padding: '1rem 0' }}>
              <table className="admin-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Tarih & Saat</th>
                    <th>Hizmetler</th>
                    <th>Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments
                    .filter(app => app.customerPhone === veresiyeDetailModal.customerPhone && app.status === 'Veresiye')
                    .map(app => (
                      <tr key={app.id}>
                        <td>{app.date} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.time}</span></td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {app.services.map(s => s.name).join(', ')}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{app.totalPrice} TL</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setVeresiyeDetailModal({ isOpen: false, customerPhone: null, customerName: null })}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Veresiye Kısmi Tahsilat Modalı */}
      {tahsilatModal.isOpen && (
        <div className="modal-overlay" onClick={() => setTahsilatModal({ isOpen: false, customerPhone: null, customerName: null, totalDebt: 0 })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <TrendingUp size={24} />
              <h3>Kısmi Tahsilat Yap</h3>
            </div>
            <form onSubmit={handleTahsilatSubmit}>
              <div className="modal-body" style={{ padding: '1.5rem 0' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  Müşteri: <strong>{tahsilatModal.customerName}</strong> <br />
                  Toplam Kalan Borç: <strong style={{ color: 'var(--gold-primary)' }}>{tahsilatModal.totalDebt} TL</strong>
                </p>
                
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label htmlFor="tahsilat-amount">Ödenen Tutar (TL) *</label>
                  <input 
                    id="tahsilat-amount"
                    type="number"
                    className="form-control"
                    required
                    placeholder="Düşülecek borç miktarı"
                    value={tahsilatAmountInput}
                    onChange={(e) => setTahsilatAmountInput(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ textAlign: 'left', marginTop: '1.25rem' }}>
                  <label htmlFor="tahsilat-method">Tahsilat Türü *</label>
                  <select 
                    id="tahsilat-method"
                    className="form-control"
                    value={tahsilatPaymentMethod}
                    onChange={(e) => setTahsilatPaymentMethod(e.target.value)}
                  >
                    <option value="Nakit">💵 Nakit</option>
                    <option value="Kart">💳 Kredi / Banka Kartı</option>
                    <option value="IBAN">🏦 IBAN / Havale</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" style={{ width: '50%' }} onClick={() => setTahsilatModal({ isOpen: false, customerPhone: null, customerName: null, totalDebt: 0 })}>
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: '50%', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}>
                  Tahsil Et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="container header-container">
          <a href="#" className="logo" onClick={(e) => { e.preventDefault(); resetBooking(); }} style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
            <img src="/logo.jpg" alt="Saloon Brothers" style={{ height: '70px', width: 'auto', objectFit: 'contain' }} />
          </a>
          <nav style={{ width: 'auto' }}>
            <ul className="nav-links">
              <li>
                <a 
                  href="#" 
                  className={activeTab === 'home' ? 'active' : ''} 
                  onClick={(e) => { e.preventDefault(); setActiveTab('home'); }}
                >
                  Ana Sayfa
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={activeTab === 'book' ? 'active' : ''} 
                  onClick={(e) => { e.preventDefault(); setActiveTab('book'); setBookingStep(1); }}
                >
                  Randevu Al
                </a>
              </li>
              <li>
                <a 
                  href="#" 
                  className={activeTab === 'admin' ? 'active' : ''} 
                  onClick={(e) => { e.preventDefault(); setActiveTab('admin'); }}
                >
                  Yönetim Paneli
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <div className="container" style={{ marginTop: '2rem' }}>
            <div className="glass-panel" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', textAlign: 'center' }}>
              <h3>Hata Oluştu</h3>
              <p>{error}</p>
              <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => window.location.reload()}>Tekrar Dene</button>
            </div>
          </div>
        )}

        {/* 1. HOME TAB */}
        {activeTab === 'home' && !error && (
          <div className="animate-fade-in">
            {/* Hero */}
            <section className="hero">
              <div className="container">
                <div className="hero-content">
                  <p className="hero-subtitle">Premium Berber Deneyimi</p>
                  <h1 className="hero-title font-serif">
                    Tarzını Yeniden <span>Keşfet</span>
                  </h1>
                  <p className="hero-desc">
                    Modern kesimler, sakal tasarımları ve lüks bakım hizmetleriyle kendinizi şımartın. 
                    Uzman kadromuzla, ayrıcalıklı bir hizmet sizi bekliyor.
                  </p>
                  <div className="hero-actions">
                    <button className="btn btn-primary" onClick={() => { setActiveTab('book'); setBookingStep(1); }}>
                      <Calendar size={18} /> Hemen Randevu Al
                    </button>
                    <button className="btn btn-secondary" onClick={() => {
                      const element = document.getElementById('services-section');
                      element?.scrollIntoView({ behavior: 'smooth' });
                    }}>
                      Hizmetlerimiz
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Features */}
            <section style={{ padding: '5rem 0', background: 'rgba(255,255,255,0.01)' }}>
              <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                  <h2 className="font-serif" style={{ fontSize: '2.5rem' }}>Neden Saloon Brothers?</h2>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Size en iyi deneyimi sunmak için her detayı tasarladık</p>
                </div>
                <div className="grid grid-cols-3">
                  <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--gold-primary)', marginBottom: '1rem' }}><Award size={40} style={{ margin: '0 auto' }} /></div>
                    <h3>Uzman Berberler</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Alanında yılların deneyimine sahip, saç ve sakal tipinizi en iyi analiz eden profesyonel ekip.
                    </p>
                  </div>
                  <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--gold-primary)', marginBottom: '1rem' }}><ShieldCheck size={40} style={{ margin: '0 auto' }} /></div>
                    <h3>Hijyen Standartları</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Kişiye özel tek kullanımlık malzemeler ve her tıraş sonrasında sterilize edilen ekipmanlar.
                    </p>
                  </div>
                  <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{ color: 'var(--gold-primary)', marginBottom: '1rem' }}><Clock size={40} style={{ margin: '0 auto' }} /></div>
                    <h3>Onaylı Randevu</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Online randevunuzu oluşturun, berberiniz tarafından onaylandığı an telefon veya e-posta bildiriminiz gelsin.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Barbers Grid */}
            <section style={{ padding: '5rem 0' }}>
              <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 className="font-serif" style={{ fontSize: '2.5rem' }}>Tasarım Ekibimiz</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Kendinizi emin ellere teslim edin</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <button 
                        className="btn" 
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: selectedBranch === 1 ? 'var(--gold-primary)' : 'transparent', color: selectedBranch === 1 ? 'var(--bg-obsidian)' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => setSelectedBranch(1)}
                      >
                        1. Şube (Merkez)
                      </button>
                      <button 
                        className="btn" 
                        style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: selectedBranch === 2 ? 'var(--gold-primary)' : 'transparent', color: selectedBranch === 2 ? 'var(--bg-obsidian)' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => setSelectedBranch(2)}
                      >
                        2. Şube (Yeni)
                      </button>
                    </div>
                    <button className="btn btn-secondary" onClick={() => { setActiveTab('book'); setBookingStep(1); }}>Tümünü Gör</button>
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  {barbers.filter(b => b.branch === selectedBranch).map(barber => (
                    <div key={barber.id} className="card" onClick={() => { setSelectedBarber(barber); setActiveTab('book'); setBookingStep(2); }}>
                      <div className="card-body" style={{ padding: '2rem' }}>
                        {barber.experience && (
                          <span className="status-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', display: 'inline-block', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                            {barber.experience}
                          </span>
                        )}
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{barber.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{barber.specialty}</p>
                        {barber.rating > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
                            <Star size={16} fill="var(--gold-primary)" />
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{barber.rating}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({barber.reviewCount} Yorum)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Services Showcase */}
            <section id="services-section" style={{ padding: '5rem 0', background: 'rgba(0,0,0,0.2)' }}>
              <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                  <h2 className="font-serif" style={{ fontSize: '2.5rem' }}>Hizmet Kataloğumuz</h2>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Kaliteli ürünler ve eşsiz tekniklerle sunduğumuz hizmetler</p>
                </div>
                <div className="grid grid-cols-3">
                  {services.map(service => (
                    <div key={service.id} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{service.name}</h3>
                          <span style={{ color: 'var(--gold-primary)', fontWeight: '700', fontSize: '1.25rem' }}>{service.price} TL</span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{service.description}</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={14} /> {service.duration} Dakika
                        </span>
                        <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => {
                          toggleService(service);
                          setActiveTab('book');
                          setBookingStep(1);
                        }}>Seç</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. BOOKING FLOW TAB */}
        {activeTab === 'book' && !error && (
          <section style={{ padding: '4rem 0' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
              
              {/* Steps Progress */}
              <div className="steps-indicator">
                <div className={`step-node ${bookingStep >= 1 ? (bookingStep > 1 ? 'completed' : 'active') : ''}`}>
                  {bookingStep > 1 ? <Check size={18} /> : '1'}
                </div>
                <div className={`step-node ${bookingStep >= 2 ? (bookingStep > 2 ? 'completed' : 'active') : ''}`}>
                  {bookingStep > 2 ? <Check size={18} /> : '2'}
                </div>
                <div className={`step-node ${bookingStep >= 3 ? (bookingStep > 3 ? 'completed' : 'active') : ''}`}>
                  {bookingStep > 3 ? <Check size={18} /> : '3'}
                </div>
                <div className={`step-node ${bookingStep >= 4 ? (bookingStep > 4 ? 'completed' : 'active') : ''}`}>
                  {bookingStep > 4 ? <Check size={18} /> : '4'}
                </div>
              </div>

              {/* Title helper per step */}
              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                {bookingStep === 1 && <h2>Tercih Ettiğiniz Berberi Seçin</h2>}
                {bookingStep === 2 && <h2>Hizmetleri Belirleyin</h2>}
                {bookingStep === 3 && <h2>Tarih ve Saat Dilimi Seçin</h2>}
                {bookingStep === 4 && <h2>Randevuyu Tamamlayın</h2>}
                {bookingStep === 5 && <h2>Randevu Talebi Gönderildi!</h2>}
              </div>

              {/* STEP 1: Barber Selection */}
              {bookingStep === 1 && (
                <div className="animate-fade-in">
                  {/* Branch Selector */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '320px', margin: '0 auto 2rem' }}>
                    <button 
                      className="btn" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', width: '50%', background: selectedBranch === 1 ? 'var(--gold-primary)' : 'transparent', color: selectedBranch === 1 ? 'var(--bg-obsidian)' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      onClick={() => { setSelectedBranch(1); setSelectedBarber(null); }}
                    >
                      1. Şube
                    </button>
                    <button 
                      className="btn" 
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', width: '50%', background: selectedBranch === 2 ? 'var(--gold-primary)' : 'transparent', color: selectedBranch === 2 ? 'var(--bg-obsidian)' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      onClick={() => { setSelectedBranch(2); setSelectedBarber(null); }}
                    >
                      2. Şube
                    </button>
                  </div>

                  <div className="grid grid-cols-3">
                    {barbers.filter(b => b.branch === selectedBranch).map(barber => (
                      <div 
                        key={barber.id} 
                        className={`card ${selectedBarber?.id === barber.id ? 'selected' : ''}`}
                        onClick={() => setSelectedBarber(barber)}
                      >
                        <div className="card-body" style={{ padding: '2rem' }}>
                          {barber.experience && (
                            <span className="status-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', display: 'inline-block', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                              {barber.experience}
                            </span>
                          )}
                          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{barber.name}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{barber.specialty}</p>
                          {barber.rating > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--gold-primary)', fontSize: '0.9rem' }}>
                              <Star size={14} fill="var(--gold-primary)" />
                              <span>{barber.rating} ({barber.reviewCount} Yorum)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
                    <button 
                      className="btn btn-primary" 
                      disabled={!selectedBarber}
                      onClick={() => setBookingStep(2)}
                    >
                      Devam Et <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Service Selection */}
              {bookingStep === 2 && (
                <div className="animate-fade-in">
                  <div className="service-list">
                    {services.map(service => {
                      const isSelected = selectedServices.some(s => s.id === service.id);
                      return (
                        <div 
                          key={service.id} 
                          className={`service-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleService(service)}
                        >
                          <div className="service-info">
                            <div className="service-checkbox">
                              {isSelected && <Check size={12} color="var(--bg-obsidian)" strokeWidth={3} />}
                            </div>
                            <div className="service-details">
                              <h4>{service.name}</h4>
                              <p>{service.description}</p>
                            </div>
                          </div>
                          <div className="service-meta">
                            <span className="service-price">{service.price} TL</span>
                            <span className="service-duration">{service.duration} Dk</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedServices.length > 0 && (
                    <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.15)' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Toplam Seçilen: {selectedServices.length} Hizmet</span>
                        <h4 style={{ color: 'var(--gold-primary)', fontSize: '1.25rem' }}>{totalPrice} TL <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 'normal' }}>({totalDuration} Dk)</span></h4>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setBookingStep(1)}>
                      <ChevronLeft size={16} /> Geri
                    </button>
                    <button 
                      className="btn btn-primary" 
                      disabled={selectedServices.length === 0}
                      onClick={() => setBookingStep(3)}
                    >
                      Devam Et <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Date & Time Picker */}
              {bookingStep === 3 && (
                <div className="animate-fade-in">
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3>Tarih Seçimi</h3>
                    <div className="calendar-grid">
                      {getNextSevenDays().map(day => (
                        <div 
                          key={day.formatted}
                          className={`calendar-day ${selectedDate === day.formatted ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedDate(day.formatted);
                            setSelectedTime('');
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.8 }}>{day.dayName}</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{day.dayNum}</span>
                        </div>
                      ))}
                    </div>

                    {selectedDate && (
                      <div className="slots-container animate-fade-in">
                        <h3>Müsait Saat Dilimleri ({selectedDate})</h3>
                        {slots.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Randevu saatleri sorgulanıyor...</p>
                        ) : (
                          <div className="slots-grid">
                            {slots.map(slot => (
                              <button
                                key={slot.time}
                                className={`slot-btn ${selectedTime === slot.time ? 'selected' : ''}`}
                                disabled={!slot.isAvailable}
                                onClick={() => setSelectedTime(slot.time)}
                              >
                                {slot.time}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => setBookingStep(2)}>
                      <ChevronLeft size={16} /> Geri
                    </button>
                    <button 
                      className="btn btn-primary" 
                      disabled={!selectedDate || !selectedTime}
                      onClick={() => setBookingStep(4)}
                    >
                      Devam Et <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Info Form & Confirmation */}
              {bookingStep === 4 && (
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                  {/* Form */}
                  <form onSubmit={handleBookingSubmit} className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Kişisel Bilgileriniz</h3>
                    
                    <div className="form-group">
                      <label htmlFor="client-name">Ad Soyad *</label>
                      <input 
                        id="client-name"
                        type="text" 
                        className="form-control" 
                        required 
                        placeholder="Örn. Ahmet Yılmaz"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="client-phone">Telefon Numarası *</label>
                      <input 
                        id="client-phone"
                        type="tel" 
                        className="form-control" 
                        required 
                        placeholder="Örn. 0555 555 5555"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="client-email">E-Posta (İsteğe Bağlı)</label>
                      <input 
                        id="client-email"
                        type="email" 
                        className="form-control" 
                        placeholder="Örn. ahmet@example.com"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label htmlFor="client-notes">Özel İstek / Not</label>
                      <textarea 
                        id="client-notes"
                        className="form-control" 
                        placeholder="Berberinize iletmek istediğiniz notlar."
                        value={customerInfo.notes}
                        onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                      />
                    </div>
                  </form>

                  {/* Summary / Receipt */}
                  <div className="receipt-card animate-scale-in">
                    <h3 className="receipt-title font-serif">RANDEVU TALEBİ</h3>
                    
                    <div className="receipt-line">
                      <span style={{ color: 'var(--text-secondary)' }}>Berber:</span>
                      <span style={{ fontWeight: '600' }}>{selectedBarber?.name}</span>
                    </div>
                    <div className="receipt-line">
                      <span style={{ color: 'var(--text-secondary)' }}>Tarih:</span>
                      <span style={{ fontWeight: '600' }}>{selectedDate}</span>
                    </div>
                    <div className="receipt-line">
                      <span style={{ color: 'var(--text-secondary)' }}>Saat:</span>
                      <span style={{ fontWeight: '600' }}>{selectedTime}</span>
                    </div>

                    <div className="receipt-divider"></div>

                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>HİZMETLER:</span>
                      {selectedServices.map(s => (
                        <div key={s.id} className="receipt-line" style={{ fontSize: '0.85rem' }}>
                          <span>{s.name}</span>
                          <span>{s.price} TL</span>
                        </div>
                      ))}
                    </div>

                    <div className="receipt-divider"></div>

                    <div className="receipt-line">
                      <span style={{ color: 'var(--text-secondary)' }}>Süre:</span>
                      <span>~ {totalDuration} Dakika</span>
                    </div>
                    <div className="receipt-line receipt-total">
                      <span>Toplam:</span>
                      <span>{totalPrice} TL</span>
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: '100%', marginTop: '2rem' }}
                      onClick={handleBookingSubmit}
                      disabled={loading}
                    >
                      {loading ? 'Talep İletiliyor...' : 'Randevu Talebini Gönder'}
                    </button>
                    
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{ width: '100%', marginTop: '0.75rem' }}
                      onClick={() => setBookingStep(3)}
                    >
                      Geri Dön
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Success screen */}
              {bookingStep === 5 && bookingSuccess && (
                <div className="animate-scale-in glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ color: 'var(--warning)', marginBottom: '1.5rem' }}>
                    <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                  </div>
                  <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Randevu Talebiniz Alındı!</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2.5rem' }}>
                    Sayın <strong>{bookingSuccess.customerName}</strong>, randevu talebiniz berberimize iletildi. 
                    Talep durumu <strong>onaylandığında</strong> sisteme düşecektir.
                  </p>

                  <div className="receipt-card" style={{ maxWidth: '400px', margin: '0 auto 3rem', textAlign: 'left' }}>
                    <h4 style={{ textAlign: 'center', marginBottom: '1.0rem', color: 'var(--gold-primary)' }}>Randevu No: #{bookingSuccess.id.slice(-6)}</h4>
                    <div className="receipt-line">
                      <span>Durum:</span>
                      <span className="status-badge pending" style={{ display: 'inline-block' }}>Beklemede (Onay Bekliyor)</span>
                    </div>
                    <div className="receipt-line">
                      <span>Berber:</span>
                      <span>{bookingSuccess.barberName}</span>
                    </div>
                    <div className="receipt-line">
                      <span>Hizmetler:</span>
                      <span>{bookingSuccess.services.map(s => s.name).join(', ')}</span>
                    </div>
                    <div className="receipt-line">
                      <span>Tutar:</span>
                      <span style={{ fontWeight: '700', color: 'var(--gold-primary)' }}>{bookingSuccess.totalPrice} TL</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button className="btn btn-primary" onClick={resetBooking}>
                      Ana Sayfaya Dön
                    </button>
                  </div>
                </div>
              )}

            </div>
          </section>
        )}

        {/* 3. ADMIN PANEL TAB WITH GATE */}
        {activeTab === 'admin' && !error && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            
            {/* LOGIN GATE */}
            {!isAdminAuthenticated ? (
              <div className="container animate-scale-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem 1.5rem' }}>
                <form onSubmit={handleAdminLogin} className="glass-panel login-card">
                  <div style={{ color: 'var(--gold-primary)', marginBottom: '1.25rem' }}>
                    <Lock size={48} style={{ margin: '0 auto' }} />
                  </div>
                  <h2 className="font-serif" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Yönetici Girişi</h2>
                   <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                    Yönetim paneline erişmek için kullanıcı adı ve şifrenizi girin.
                  </p>
                  
                  {loginError && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                      <AlertTriangle size={14} />
                      {loginError}
                    </div>
                  )}

                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
                    <label htmlFor="admin-user">Kullanıcı Adı</label>
                    <input 
                      id="admin-user"
                      type="text"
                      className="form-control"
                      placeholder="Kullanıcı adı"
                      required
                      value={adminUsernameInput}
                      onChange={(e) => setAdminUsernameInput(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                    <label htmlFor="admin-pass">Şifre</label>
                    <input 
                      id="admin-pass"
                      type="password"
                      className="form-control"
                      placeholder="••••••••"
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Giriş Yap
                  </button>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
                    Yetkili kullanıcı adı ve şifresiyle oturum açın.
                  </p>
                </form>
              </div>
            ) : (
              /* AUTHENTICATED PANEL */
              <section style={{ padding: '4rem 0', flex: 1 }}>
                <div className="container animate-fade-in">
                  
                  {/* Top Bar Dashboard */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h2 className="font-serif" style={{ fontSize: '2.5rem' }}>Yönetim Paneli {loggedInUser?.role === 'barber' ? `- ${loggedInUser.name}` : ''}</h2>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        {loggedInUser?.role === 'barber' 
                          ? 'Kişisel randevularınız ve ciro takibiniz.' 
                          : 'Saloon Brothers dükkan yönetimi, mali göstergeler ve randevular.'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-secondary" onClick={playNotificationSound}>
                        Sesi Test Et
                      </button>
                      <button className="btn btn-secondary" onClick={loadAdminDashboardData} disabled={loading}>
                        Yenile
                      </button>
                      <button className="btn btn-danger btn-icon" onClick={handleAdminLogout} title="Çıkış Yap">
                        <LogOut size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Financial Statistic Cards (Kasa, Veresiye, Gider, Net Kar) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {loggedInUser?.role === 'barber' ? 'Kişisel Ciro (Gelir)' : 'Kasa (Nakit / Kart)'}
                        </span>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--success)' }}>{totalRevenue} TL</h2>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {loggedInUser?.role === 'barber' ? 'Tamamladığınız randevular' : 'Tahsil edilen nakit gelir'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                        <TrendingUp size={24} />
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {loggedInUser?.role === 'barber' ? 'Kişisel Veresiye (Alacak)' : 'Veresiye Alacaklar'}
                        </span>
                        <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: '#a78bfa' }}>{totalVeresiye} TL</h2>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {loggedInUser?.role === 'barber' ? 'Deftere yazılan borçlarınız' : 'Deftere yazılan borçlar'}
                        </span>
                      </div>
                      <div style={{ color: '#a78bfa', background: 'rgba(139, 92, 246, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                        <Bell size={24} />
                      </div>
                    </div>

                    {loggedInUser?.role !== 'barber' && (
                      <>
                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toplam Gider</span>
                            <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: 'var(--danger)' }}>{totalExpense} TL</h2>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tüm dükkan harcamaları</span>
                          </div>
                          <div style={{ color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                            <TrendingDown size={24} />
                          </div>
                        </div>

                        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: netProfit >= 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Nakit Kar</span>
                            <h2 style={{ fontSize: '2rem', marginTop: '0.25rem', color: netProfit >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}>{netProfit} TL</h2>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Eldeki Nakit - Giderler</span>
                          </div>
                          <div style={{ color: netProfit >= 0 ? 'var(--text-primary)' : 'var(--danger)', background: netProfit >= 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                            <DollarSign size={24} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Sub-tab Navigation (Randevular vs. Finans & Giderler) */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                    <button 
                      style={{ 
                        padding: '1rem 2rem', 
                        background: 'none', 
                        border: 'none', 
                        borderBottom: adminSubTab === 'appointments' ? '2px solid var(--gold-primary)' : 'none',
                        color: adminSubTab === 'appointments' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onClick={() => setAdminSubTab('appointments')}
                    >
                      Randevu Yönetimi
                    </button>
                    {loggedInUser?.role !== 'barber' && (
                      <button 
                        style={{ 
                          padding: '1rem 2rem', 
                          background: 'none', 
                          border: 'none', 
                          borderBottom: adminSubTab === 'finance' ? '2px solid var(--gold-primary)' : 'none',
                          color: adminSubTab === 'finance' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                        onClick={() => setAdminSubTab('finance')}
                      >
                        Gider Ekle & Finans
                      </button>
                    )}
                  </div>

                  {/* SUBTAB 1: APPOINTMENTS MANAGEMENT */}
                  {adminSubTab === 'appointments' && (
                    <div className="animate-fade-in">
                      {/* Tabs Filters */}
                      <div className="tab-filters">
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Beklemede' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Beklemede')}
                        >
                          Bekleyen Talepler ({userAppointments.filter(a => a.status === 'Beklemede').length})
                        </button>
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Onaylandı' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Onaylandı')}
                        >
                          Onaylananlar ({userAppointments.filter(a => a.status === 'Onaylandı').length})
                        </button>
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Tamamlandı' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Tamamlandı')}
                        >
                          Tamamlananlar ({userAppointments.filter(a => a.status === 'Tamamlandı').length})
                        </button>
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Veresiye' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Veresiye')}
                        >
                          Veresiyeler ({userAppointments.filter(a => a.status === 'Veresiye').length})
                        </button>
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Tamamlanmadı' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Tamamlanmadı')}
                        >
                          Gelmeyenler ({userAppointments.filter(a => a.status === 'Tamamlanmadı').length})
                        </button>
                        <button 
                          className={`tab-filter-btn ${adminFilter === 'Tümü' ? 'active' : ''}`}
                          onClick={() => setAdminFilter('Tümü')}
                        >
                          Tüm Randevular ({userAppointments.length})
                        </button>
                      </div>

                      {adminFilter === 'Veresiye' ? (
                        /* Grouped Veresiye Cari Listesi */
                        getGroupedVeresiyeler().length === 0 ? (
                          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                              Aktif veresiye borcu bulunan müşteri bulunmamaktadır.
                            </p>
                          </div>
                        ) : (
                          <div className="glass-panel" style={{ padding: '2rem' }}>
                            <div className="admin-table-container">
                              <table className="admin-table">
                                <thead>
                                  <tr>
                                    <th>Müşteri Adı</th>
                                    <th>Telefon Numarası</th>
                                    <th>Toplam Borç</th>
                                    <th>Aksiyonlar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {getGroupedVeresiyeler().map((debtor) => (
                                    <tr key={debtor.customerPhone}>
                                      <td style={{ fontWeight: '600' }}>{debtor.customerName}</td>
                                      <td>{debtor.customerPhone}</td>
                                      <td style={{ fontWeight: 'bold', color: 'var(--danger)', fontSize: '1.1rem' }}>
                                        {debtor.totalDebt} TL
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <button 
                                            className="btn btn-secondary" 
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                            onClick={() => setVeresiyeDetailModal({ isOpen: true, customerPhone: debtor.customerPhone, customerName: debtor.customerName })}
                                          >
                                            👁️ Detay Gör
                                          </button>
                                          <button 
                                            className="btn btn-primary" 
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                                            onClick={() => {
                                              setTahsilatModal({
                                                isOpen: true,
                                                customerPhone: debtor.customerPhone,
                                                customerName: debtor.customerName,
                                                totalDebt: debtor.totalDebt
                                              });
                                              setTahsilatAmountInput(debtor.totalDebt.toString());
                                            }}
                                          >
                                            💰 Borç Düş (Tahsilat)
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      ) : (
                        /* Standard Appointments View */
                        filteredAppointments.length === 0 ? (
                          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                              Bu kategoride kayıtlı randevu bulunmamaktadır.
                            </p>
                          </div>
                        ) : (
                          <div className="glass-panel" style={{ padding: '2rem' }}>
                            <div className="admin-table-container">
                              <table className="admin-table">
                                <thead>
                                  <tr>
                                    <th>No</th>
                                    <th>Müşteri Adı</th>
                                    <th>Telefon</th>
                                    <th>Berber</th>
                                    <th>Hizmetler</th>
                                    <th>Tarih & Saat</th>
                                    <th>Tutar</th>
                                    <th>Durum</th>
                                    <th>Aksiyonlar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredAppointments.map((app) => (
                                    <tr key={app.id}>
                                      <td style={{ fontWeight: 'bold' }}>#{app.id.slice(-6)}</td>
                                      <td>{app.customerName}</td>
                                      <td>{app.customerPhone}</td>
                                      <td style={{ color: 'var(--gold-primary)' }}>{app.barberName}</td>
                                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {app.services.map(s => s.name).join(', ')}
                                      </td>
                                      <td>
                                        <span style={{ fontWeight: '600' }}>{app.date}</span> <br />
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{app.time}</span>
                                      </td>
                                      <td style={{ fontWeight: 'bold' }}>{app.totalPrice} TL</td>
                                      <td>
                                        <span className={`status-badge ${
                                          app.status === 'Onaylandı' ? 'confirmed' : 
                                          app.status === 'Beklemede' ? 'pending' : 
                                          app.status === 'Tamamlandı' ? 'confirmed' : 
                                          app.status === 'Veresiye' ? 'veresiye' : 
                                          app.status === 'Tamamlanmadı' ? 'no-show' : 'cancelled'
                                        }`} style={app.status === 'Tamamlandı' ? { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' } : {}}>
                                          {app.status === 'Tamamlanmadı' ? 'Gelmedi' : app.status}
                                          {app.status === 'Tamamlandı' && app.paymentMethod && ` (${app.paymentMethod})`}
                                        </span>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          {app.status === 'Beklemede' && (
                                            <>
                                              <button 
                                                className="btn btn-primary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Onaylandı')}
                                              >
                                                Onayla
                                              </button>
                                              <button 
                                                className="btn btn-secondary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                                onClick={() => handleUpdateStatus(app.id, 'İptal Edildi')}
                                              >
                                                Reddet
                                              </button>
                                            </>
                                          )}
                                          {app.status === 'Onaylandı' && (
                                            <>
                                              <button 
                                                className="btn btn-primary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Tamamlandı')}
                                              >
                                                Ödendi (Nakit/Kart)
                                              </button>
                                              <button 
                                                className="btn btn-primary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: '#fff' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Veresiye')}
                                              >
                                                Veresiye Yaz
                                              </button>
                                              <button 
                                                className="btn btn-secondary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Tamamlanmadı')}
                                              >
                                                Gelmedi
                                              </button>
                                            </>
                                          )}
                                          {app.status === 'Veresiye' && (
                                            <>
                                              <button 
                                                className="btn btn-primary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Tamamlandı')}
                                              >
                                                Ödemeyi Kapat (Tahsil Et)
                                              </button>
                                              <button 
                                                className="btn btn-secondary btn-icon" 
                                                title="Sil"
                                                onClick={() => handleCancelAppointment(app.id)}
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </>
                                          )}
                                          {app.status === 'Tamamlanmadı' && (
                                            <>
                                              <button 
                                                className="btn btn-primary" 
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                onClick={() => handleUpdateStatus(app.id, 'Onaylandı')}
                                              >
                                                Tekrar Onayla
                                              </button>
                                              <button 
                                                className="btn btn-secondary btn-icon" 
                                                title="Sil"
                                                onClick={() => handleCancelAppointment(app.id)}
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </>
                                          )}
                                          {(app.status === 'İptal Edildi' || app.status === 'Tamamlandı') && (
                                            <button 
                                              className="btn btn-secondary btn-icon" 
                                              title="Sistemden Sil"
                                              onClick={() => handleCancelAppointment(app.id)}
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* SUBTAB 2: FINANCIALS & EXPENSE TRACKING */}
                  {adminSubTab === 'finance' && (
                    <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '2rem' }}>
                      
                      {/* Gider Ekle Formu */}
                      <form onSubmit={handleExpenseSubmit} className="glass-panel" style={{ padding: '2rem', height: 'fit-content' }}>
                        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <PlusCircle size={20} />
                          Yeni Gider Girişi
                        </h3>

                        <div className="form-group">
                          <label htmlFor="exp-title">Gider Açıklaması *</label>
                          <input 
                            id="exp-title"
                            type="text"
                            className="form-control"
                            required
                            placeholder="Örn. Dükkan Kirası"
                            value={expenseForm.title}
                            onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="exp-amount">Tutar (TL) *</label>
                          <input 
                            id="exp-amount"
                            type="number"
                            className="form-control"
                            required
                            placeholder="Örn. 3500"
                            value={expenseForm.amount}
                            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="exp-cat">Kategori *</label>
                          <select 
                            id="exp-cat"
                            className="form-control"
                            value={expenseForm.category}
                            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                            style={{ WebkitAppearance: 'none' }}
                          >
                            <option value="Kira">Kira</option>
                            <option value="Malzeme">Malzeme / Ürün</option>
                            <option value="Fatura">Fatura (Elektrik, Su vb.)</option>
                            <option value="Maaş">Personel Maaşı</option>
                            <option value="Diğer">Diğer Giderler</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label htmlFor="exp-date">Gider Tarihi *</label>
                          <input 
                            id="exp-date"
                            type="date"
                            className="form-control"
                            required
                            value={expenseForm.date}
                            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="exp-notes">Notlar</label>
                          <textarea 
                            id="exp-notes"
                            className="form-control"
                            placeholder="Gider hakkında ek bilgiler..."
                            value={expenseForm.notes}
                            onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                            style={{ minHeight: '80px' }}
                          />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                          Gideri Kaydet
                        </button>
                      </form>

                      {/* Gider Listesi */}
                      <div className="glass-panel" style={{ padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Gider Hareketleri</h3>

                        {expenses.length === 0 ? (
                          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Henüz kaydedilmiş bir gider bulunmamaktadır.</p>
                        ) : (
                          <div className="admin-table-container">
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Açıklama</th>
                                  <th>Kategori</th>
                                  <th>Tarih</th>
                                  <th>Tutar</th>
                                  <th>Not</th>
                                  <th>Aksiyon</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expenses.map((exp) => (
                                  <tr key={exp.id}>
                                    <td style={{ fontWeight: '600' }}>{exp.title}</td>
                                    <td>
                                      <span className="status-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                                        {exp.category}
                                      </span>
                                    </td>
                                    <td>{exp.date}</td>
                                    <td style={{ fontWeight: '700', color: 'var(--danger)' }}>-{exp.amount} TL</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={exp.notes}>
                                      {exp.notes || '-'}
                                    </td>
                                    <td>
                                      <button 
                                        className="btn btn-danger btn-icon"
                                        onClick={() => handleDeleteExpense(exp.id)}
                                        title="Gideri Sil"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>© 2026 <span>Saloon Brothers</span> Luxury Barber Shop. Tüm Hakları Saklıdır.</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            Lüks saç kesimi, profesyonel cilt bakımı ve sakal tasarımı.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
