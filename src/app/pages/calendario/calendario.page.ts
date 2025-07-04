import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, collectionData, query, orderBy } from '@angular/fire/firestore';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface Recordatorio {
  id?: string;
  fecha: string;       // Formato YYYY-MM-DD (UTC)
  hora: string;        // Formato HH:MM (24h)
  descripcion: string;
  timestamp: number;   // Timestamp en UTC
  notificationId?: number;
}

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.page.html',
  styleUrls: ['./calendario.page.scss'],
  standalone: false
})
export class CalendarioPage implements OnInit {
  fechaSeleccionada: string = '';
  recordatorios: Recordatorio[] = [];
  recordatoriosFiltrados: Recordatorio[] = [];
  loading = true;

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController,
    private firestore: Firestore
  ) {
    // Establecer fecha actual en formato local (YYYY-MM-DD)
    const hoy = new Date();
    this.fechaSeleccionada = this.formatLocalDate(hoy);
  }

  async ngOnInit() {
    await this.requestNotificationPermissions();
    this.cargarRecordatorios();
  }

  // 🔄 Formatear fecha local (YYYY-MM-DD)
  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ⏳ Convertir fecha local a UTC para Firebase
  private convertToUTC(dateString: string, timeString: string): { dateUTC: string, timestampUTC: number } {
    const localDate = new Date(`${dateString}T${timeString}`);
    const utcDate = new Date(
      Date.UTC(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours(),
        localDate.getMinutes()
      )
    );
    
    return {
      dateUTC: utcDate.toISOString().split('T')[0], // Fecha UTC (YYYY-MM-DD)
      timestampUTC: utcDate.getTime()               // Timestamp UTC
    };
  }

  // 🔔 Solicitar permisos para notificaciones
  async requestNotificationPermissions() {
    try {
      await LocalNotifications.requestPermissions();
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
    }
  }

  // 📥 Cargar recordatorios desde Firebase
  cargarRecordatorios() {
    this.loading = true;
    const recordatoriosRef = collection(this.firestore, 'recordatorios');
    const q = query(recordatoriosRef, orderBy('timestamp', 'asc'));
    
    collectionData(q, { idField: 'id' }).subscribe({
      next: (recordatorios: any[]) => {
        this.recordatorios = recordatorios.map(r => ({
          ...r,
          fecha: r.fecha.split('T')[0] // Normalizar formato
        })) as Recordatorio[];
        
        this.filtrarRecordatoriosPorFecha();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando recordatorios:', error);
        this.mostrarToast('Error al cargar recordatorios', 'danger');
        this.loading = false;
      }
    });
  }

  // 📅 Cuando se selecciona una fecha
  onFechaSeleccionada(event: any) {
    if (event?.detail?.value) {
      this.fechaSeleccionada = event.detail.value.split('T')[0];
      console.log('Fecha seleccionada (local):', this.fechaSeleccionada);
      this.filtrarRecordatoriosPorFecha();
    }
  }

  // 🔍 Filtrar recordatorios por fecha seleccionada
  filtrarRecordatoriosPorFecha() {
    if (!this.recordatorios || !this.fechaSeleccionada) {
      this.recordatoriosFiltrados = [];
      return;
    }

    // Convertir fecha seleccionada a UTC para comparación
    const { dateUTC } = this.convertToUTC(this.fechaSeleccionada, '00:00');
    
    this.recordatoriosFiltrados = this.recordatorios.filter(
      recordatorio => recordatorio.fecha === dateUTC
    );
  }

  // ➕ Crear nuevo recordatorio
  async crearRecordatorio() {
    const alert = await this.alertController.create({
      header: 'Nuevo Recordatorio',
      inputs: [
        {
          name: 'hora',
          type: 'time',
          placeholder: 'Hora (ej: 14:30)',
          value: '12:00'
        },
        {
          name: 'descripcion',
          type: 'textarea',
          placeholder: '¿Qué quieres recordar?'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.hora && data.descripcion) {
              await this.guardarRecordatorio(data.hora, data.descripcion);
              return true;
            }
            this.mostrarToast('Completa todos los campos', 'warning');
            return false;
          }
        }
      ]
    });

    await alert.present();
  }

  // 💾 Guardar recordatorio en Firebase
  async guardarRecordatorio(hora: string, descripcion: string) {
    try {
      const { dateUTC, timestampUTC } = this.convertToUTC(this.fechaSeleccionada, hora);
      const notificationId = Date.now();

      const recordatorio: Recordatorio = {
        fecha: dateUTC,
        hora: hora,
        descripcion: descripcion,
        timestamp: timestampUTC,
        notificationId: notificationId
      };

      // Guardar en Firebase
      const recordatoriosRef = collection(this.firestore, 'recordatorios');
      await addDoc(recordatoriosRef, recordatorio);

      // Programar notificación (usando hora local)
      await this.programarNotificacion({
        ...recordatorio,
        fecha: this.fechaSeleccionada
      });

      this.mostrarToast('Recordatorio guardado', 'success');
      this.cargarRecordatorios(); // Actualizar lista
    } catch (error) {
      console.error('Error:', error);
      this.mostrarToast('Error al guardar', 'danger');
    }
  }

  // 🔔 Programar notificación local
  async programarNotificacion(recordatorio: Recordatorio) {
    try {
      const fechaNotificacion = new Date(`${recordatorio.fecha}T${recordatorio.hora}`);
      
      if (fechaNotificacion > new Date()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Recordatorio',
              body: recordatorio.descripcion,
              id: recordatorio.notificationId!,
              schedule: { at: fechaNotificacion },
              sound: 'default'
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error programando notificación:', error);
    }
  }

  // ✏️ Editar recordatorio existente
  async editarRecordatorio(recordatorio: Recordatorio) {
    const alert = await this.alertController.create({
      header: 'Editar Recordatorio',
      inputs: [
        {
          name: 'hora',
          type: 'time',
          value: recordatorio.hora
        },
        {
          name: 'descripcion',
          type: 'textarea',
          value: recordatorio.descripcion
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.hora && data.descripcion) {
              await this.actualizarRecordatorio(
                recordatorio.id!,
                data.hora,
                data.descripcion,
                recordatorio.notificationId!
              );
              return true;
            }
            this.mostrarToast('Completa todos los campos', 'warning');
            return false;
          }
        }
      ]
    });

    await alert.present();
  }

  // 🔄 Actualizar recordatorio en Firebase
  async actualizarRecordatorio(id: string, hora: string, descripcion: string, notificationId: number) {
    try {
      const { dateUTC, timestampUTC } = this.convertToUTC(this.fechaSeleccionada, hora);

      const recordatorioActualizado: Partial<Recordatorio> = {
        fecha: dateUTC,
        hora: hora,
        descripcion: descripcion,
        timestamp: timestampUTC
      };

      // Actualizar en Firebase
      const recordatorioRef = doc(this.firestore, 'recordatorios', id);
      await updateDoc(recordatorioRef, recordatorioActualizado);

      // Cancelar notificación anterior
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

      // Programar nueva notificación
      await this.programarNotificacion({
        ...recordatorioActualizado,
        fecha: this.fechaSeleccionada,
        notificationId: notificationId
      } as Recordatorio);

      this.mostrarToast('Recordatorio actualizado', 'success');
      this.cargarRecordatorios();
    } catch (error) {
      console.error('Error:', error);
      this.mostrarToast('Error al actualizar', 'danger');
    }
  }

  // 🗑️ Eliminar recordatorio
  async eliminarRecordatorio(recordatorio: Recordatorio) {
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: '¿Eliminar este recordatorio?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              // Eliminar de Firebase
              const recordatorioRef = doc(this.firestore, 'recordatorios', recordatorio.id!);
              await deleteDoc(recordatorioRef);

              // Cancelar notificación
              if (recordatorio.notificationId) {
                await LocalNotifications.cancel({ 
                  notifications: [{ id: recordatorio.notificationId }] 
                });
              }

              this.mostrarToast('Recordatorio eliminado', 'success');
              this.cargarRecordatorios();
            } catch (error) {
              console.error('Error:', error);
              this.mostrarToast('Error al eliminar', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // 💬 Mostrar mensaje Toast
  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  // 🕒 Formatear hora (HH:MM → 12h AM/PM)
  formatearHora(hora: string): string {
    return new Date(`2000-01-01T${hora}`).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 📅 Formatear fecha (UTC → texto legible)
  formatearFecha(fechaUTC: string): string {
    // Solución definitiva: usar componentes de fecha directamente
    const [year, month, day] = fechaUTC.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day);
    
    return fechaLocal.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}