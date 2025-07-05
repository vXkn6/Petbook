import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Firestore, collection, query, where, getDocs, orderBy, limit, startAt, endAt } from '@angular/fire/firestore';
import { Chart, registerables, TooltipItem } from 'chart.js';
import { format, subDays, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

@Component({
  selector: 'app-chat-analytics',
  templateUrl: './chat-analytics.page.html',
  styleUrls: ['./chat-analytics.page.scss'],
  standalone: false,
})
export class ChatAnalyticsPage implements OnInit {
  @ViewChild('topQuestionsChart') topQuestionsChartRef!: ElementRef;
  @ViewChild('monthlyTrendsChart') monthlyTrendsChartRef!: ElementRef;
  @ViewChild('categoriesChart') categoriesChartRef!: ElementRef;

  dateRange = '30'; // Default: últimos 30 días
  startDate: string = subDays(new Date(), 30).toISOString();
  endDate: string = new Date().toISOString();

  // Datos estadísticos
  totalQuestions = 0;
  uniqueQuestions = 0;
  autoResponses = 0;
  unansweredQuestions = 0;
  autoResponsePercentage = 0;
  unansweredPercentage = 0;

  topQuestions: any[] = [];
  monthlyTrends: any[] = [];
  categories: any[] = [];
  predictions: any[] = [];

  private topQuestionsChart!: Chart<'bar'>;
  private monthlyTrendsChart!: Chart<'line'>;
  private categoriesChart!: Chart<'doughnut'>;

  constructor(private firestore: Firestore) {
    Chart.register(...registerables);
  }

  ngOnInit() {
    const defaultStartDate = subDays(new Date(), 30);
    this.startDate = defaultStartDate.toISOString();
    this.loadData();
  }

  async loadData() {
    try {
      const startDate = this.dateRange === 'custom' ? parseISO(this.startDate) :
        subDays(new Date(), parseInt(this.dateRange));
      const endDate = this.dateRange === 'custom' ? parseISO(this.endDate) : new Date();

      console.log('Cargando datos...'); // Debug

      await this.loadGeneralStats(startDate, endDate);
      await this.loadTopQuestions(startDate, endDate);
      await this.loadMonthlyTrends(startDate, endDate);
      await this.loadCategories(startDate, endDate);
      await this.generatePredictions(startDate, endDate);

      console.log('Datos cargados:', { // Debug
        categories: this.categories,
        topQuestions: this.topQuestions,
        monthlyTrends: this.monthlyTrends
      });

      this.createCharts();
    } catch (error) {
      console.error('Error al cargar datos:', error);
    }
  }

  async loadGeneralStats(startDate: Date, endDate: Date) {
    const messagesRef = collection(this.firestore, 'chat-messages');

    // Consulta para mensajes de usuario (preguntas)
    const userMessagesQuery = query(
      messagesRef,
      where('timestamp', '>=', startDate),
      where('isUser', '==', true)
    );

    const userMessagesSnapshot = await getDocs(userMessagesQuery);
    this.totalQuestions = userMessagesSnapshot.size;

    // Contar preguntas únicas
    const uniqueTexts = new Set();
    userMessagesSnapshot.forEach(doc => {
      uniqueTexts.add(doc.data()['text'].toLowerCase().trim());
    });
    this.uniqueQuestions = uniqueTexts.size;

    // Consulta para mensajes del bot con respuestas automáticas
    const botMessagesQuery = query(
      messagesRef,
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      where('isUser', '==', false)
    );

    const botMessagesSnapshot = await getDocs(botMessagesQuery);
    let autoResponseCount = 0;
    let unansweredCount = 0;

    botMessagesSnapshot.forEach(doc => {
      const text = doc.data()['text'];
      if (text.includes('No estoy seguro') || text.includes('reformula tu pregunta')) {
        unansweredCount++;
      } else {
        autoResponseCount++;
      }
    });

    this.autoResponses = autoResponseCount;
    this.unansweredQuestions = unansweredCount;
    this.autoResponsePercentage = this.totalQuestions > 0 ? this.autoResponses / this.totalQuestions : 0;
    this.unansweredPercentage = this.totalQuestions > 0 ? this.unansweredQuestions / this.totalQuestions : 0;
  }

  async loadTopQuestions(startDate: Date, endDate: Date) {
    const messagesRef = collection(this.firestore, 'chat-messages');
    const userMessagesQuery = query(
      messagesRef,
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      where('isUser', '==', true)
    );

    const snapshot = await getDocs(userMessagesQuery);
    const questionCounts: { [key: string]: number } = {};

    snapshot.forEach(doc => {
      const text = doc.data()['text'].toLowerCase().trim();
      questionCounts[text] = (questionCounts[text] || 0) + 1;
    });

    // Ordenar por frecuencia y tomar las 10 principales
    this.topQuestions = Object.entries(questionCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async loadMonthlyTrends(startDate: Date, endDate: Date) {
    const messagesRef = collection(this.firestore, 'chat-messages');
    const userMessagesQuery = query(
      messagesRef,
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      where('isUser', '==', true)
    );

    const snapshot = await getDocs(userMessagesQuery);
    const monthlyCounts: { [key: string]: number } = {};

    snapshot.forEach(doc => {
      const timestamp = doc.data()['timestamp'].toDate();
      const monthKey = format(timestamp, 'yyyy-MM', { locale: es });
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
    });

    // Ordenar por mes
    this.monthlyTrends = Object.entries(monthlyCounts)
      .map(([month, count]) => ({
        month,
        count,
        monthName: format(new Date(`${month}-01`), 'MMMM yyyy', { locale: es })
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async loadCategories(startDate: Date, endDate: Date) {
    // Definir categorías basadas en las palabras clave del chatbot
    const categories = {
      'Horarios': ['horario', 'horas disponibles', 'disponible', 'abierto'],
      'Ubicación': ['ubicación', 'dirección', 'dónde están', 'localización'],
      'Contacto': ['contactar', 'teléfono', 'email', 'correo', 'llamar'],
      'Servicios': ['servicio', 'qué ofrecen', 'qué hacen', 'vacunas', 'desparasitación', 'peluquería'],
      'Precios': ['precio', 'costo', 'cuánto cuesta', 'vale'],
      'Emergencias': ['emergencia', 'urgencia', 'mi perro está mal', 'mi gato está enfermo'],
      'Citas': ['cita', 'agendar', 'reservar hora']
    };

    const messagesRef = collection(this.firestore, 'chat-messages');
    const userMessagesQuery = query(
      messagesRef,
      where('timestamp', '>=', startDate),
      where('timestamp', '<=', endDate),
      where('isUser', '==', true)
    );

    const snapshot = await getDocs(userMessagesQuery);
    const categoryCounts: { [key: string]: number } = {};

    // Inicializar categorías
    Object.keys(categories).forEach(cat => {
      categoryCounts[cat] = 0;
    });
    categoryCounts['Otras'] = 0;

    // Contar preguntas por categoría
    snapshot.forEach(doc => {
      const text = doc.data()['text'].toLowerCase();
      let categorized = false;

      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          categoryCounts[category]++;
          categorized = true;
          break;
        }
      }

      if (!categorized) {
        categoryCounts['Otras']++;
      }
    });

    this.categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  async generatePredictions(startDate: Date, endDate: Date) {
    // Obtener datos de los últimos 6 meses para comparar
    const comparisonStartDate = subMonths(startDate, 6);
    const comparisonEndDate = subMonths(endDate, 6);

    // Cargar categorías actuales y de hace 6 meses
    await this.loadCategories(startDate, endDate);
    const currentCategories = [...this.categories];

    await this.loadCategories(comparisonStartDate, comparisonEndDate);
    const pastCategories = [...this.categories];

    // Generar predicciones basadas en el cambio porcentual
    this.predictions = currentCategories.map(currentCat => {
      const pastCat = pastCategories.find(c => c.name === currentCat.name);
      const pastCount = pastCat ? pastCat.count : 1; // Evitar división por cero

      const change = Math.round(((currentCat.count - pastCount) / pastCount) * 100);
      const trend = change >= 0 ? 'aumento' : 'disminución';

      return {
        category: currentCat.name,
        change: Math.abs(change),
        trend
      };
    }).slice(0, 5); // Mostrar solo las 5 principales

    // Añadir predicción estacional si es relevante
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 10 || currentMonth <= 2) { // Nov-Feb (verano en Chile)
      this.predictions.unshift({
        category: 'Vacaciones de verano',
        change: 35,
        trend: 'aumento',
        note: 'Mayor interés en servicios de peluquería y desparasitación'
      });
    }
  }

  createCharts() {
    // Gráfico de preguntas frecuentes
    if (this.topQuestionsChart) {
      this.topQuestionsChart.destroy();
    }

    this.topQuestionsChart = new Chart(this.topQuestionsChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.topQuestions.map(q => q.text.length > 20 ? q.text.substring(0, 20) + '...' : q.text),
        datasets: [{
          label: 'Número de veces preguntado',
          data: this.topQuestions.map(q => q.count),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = this.topQuestions[context.dataIndex].text;
                return `${label}: ${context.raw} veces`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });

    // Gráfico de tendencias mensuales
    if (this.monthlyTrendsChart) {
      this.monthlyTrendsChart.destroy();
    }

    this.monthlyTrendsChart = new Chart(this.monthlyTrendsChartRef.nativeElement, {
      type: 'line',
      data: {
        labels: this.monthlyTrends.map(t => t.monthName),
        datasets: [{
          label: 'Preguntas por mes',
          data: this.monthlyTrends.map(t => t.count),
          fill: false,
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });

    // Gráfico de categorías
    if (this.categoriesChart) {
      this.categoriesChart.destroy();
    }

    if (this.categories.length > 0) {
      this.categoriesChart = new Chart(this.categoriesChartRef.nativeElement, {
        type: 'doughnut',
        data: {
          labels: this.categories.map(c => c.name),
          datasets: [{
            data: this.categories.map(c => c.count),
            backgroundColor: [
              'rgba(255, 99, 132, 0.7)',
              'rgba(54, 162, 235, 0.7)',
              'rgba(255, 206, 86, 0.7)',
              'rgba(75, 192, 192, 0.7)',
              'rgba(153, 102, 255, 0.7)',
              'rgba(255, 159, 64, 0.7)',
              'rgba(199, 199, 199, 0.7)',
              'rgba(83, 102, 255, 0.7)',
              'rgba(255, 99, 132, 0.7)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false, // Añade esta línea
          plugins: {
            legend: {
              position: 'right'
            },
            tooltip: {
              callbacks: {
                label: (context: TooltipItem<'doughnut'>) => {
                  const total = this.categories.reduce((sum, cat) => sum + cat.count, 0);
                  const value = context.raw as number;
                  const percentage = Math.round((value / total) * 100);
                  return `${context.label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } else {
      console.warn('No hay datos de categorías para mostrar el gráfico');
    }
  }

  refreshData() {
    this.loadData();
  }
}