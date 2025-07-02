import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, collectionData, query, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface Recordatorio {
  id?: string;
  fecha: string;
  hora: string;
  descripcion: string;
  timestamp: number;
  notificationId?: number;
}

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.page.html',
  styleUrls: ['./calendario.page.scss'],
  standalone: false,
})
export class CalendarioPage implements OnInit {
  fechaSeleccionada: string = '';
  recordatorios: Recordatorio[] = [];
  recordatoriosFiltrados: Recordatorio[] = [];
  
  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController,
    private firestore: Firestore
  ) {
    // Establecer fecha actual por defecto
    const hoy = new Date();
    this.fechaSeleccionada = hoy.toISOString().split('T')[0];
  }

  async ngOnInit() {
    await this.requestNotificationPermissions();
    this.cargarRecordatorios();
  }

  async requestNotificationPermissions() {
    try {
      await LocalNotifications.requestPermissions();
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  }

  cargarRecordatorios() {
    const recordatoriosRef = collection(this.firestore, 'recordatorios');
    const q = query(recordatoriosRef, orderBy('timestamp', 'asc'));
    
    collectionData(q, { idField: 'id' }).subscribe({
      next: (recordatorios: any[]) => {
        this.recordatorios = recordatorios as Recordatorio[];
        this.filtrarRecordatoriosPorFecha();
      },
      error: (error) => {
        console.error('Error cargando recordatorios:', error);
        this.mostrarToast('Error al cargar recordatorios', 'danger');
      }
    });
  }

  onFechaSeleccionada(event: any) {
    this.fechaSeleccionada = event.detail.value.split('T')[0];
    this.filtrarRecordatoriosPorFecha();
  }

  filtrarRecordatoriosPorFecha() {
    this.recordatoriosFiltrados = this.recordatorios.filter(
      recordatorio => recordatorio.fecha === this.fechaSeleccionada
    );
  }

  async crearRecordatorio() {
    const alert = await this.alertController.create({
      header: 'Nuevo Recordatorio',
      inputs: [
        {
          name: 'hora',
          type: 'time',
          placeholder: 'Hora del recordatorio'
        },
        {
          name: 'descripcion',
          type: 'textarea',
          placeholder: 'Descripción del recordatorio'
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
            } else {
              this.mostrarToast('Por favor completa todos los campos', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async guardarRecordatorio(hora: string, descripcion: string) {
    try {
      const fechaHora = new Date(`${this.fechaSeleccionada}T${hora}`);
      const notificationId = Date.now();

      const recordatorio: Recordatorio = {
        fecha: this.fechaSeleccionada,
        hora: hora,
        descripcion: descripcion,
        timestamp: fechaHora.getTime(),
        notificationId: notificationId
      };

      // Guardar en Firebase
      const recordatoriosRef = collection(this.firestore, 'recordatorios');
      await addDoc(recordatoriosRef, recordatorio);

      // Programar notificación
      await this.programarNotificacion(recordatorio);

      this.mostrarToast('Recordatorio creado exitosamente', 'success');
    } catch (error) {
      console.error('Error guardando recordatorio:', error);
      this.mostrarToast('Error al crear recordatorio', 'danger');
    }
  }

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
              sound: 'default',
              attachments: [],
              actionTypeId: "",
              extra: null
            }
          ]
        });
      }
    } catch (error) {
      console.error('Error programando notificación:', error);
    }
  }

  async editarRecordatorio(recordatorio: Recordatorio) {
    const alert = await this.alertController.create({
      header: 'Editar Recordatorio',
      inputs: [
        {
          name: 'hora',
          type: 'time',
          value: recordatorio.hora,
          placeholder: 'Hora del recordatorio'
        },
        {
          name: 'descripcion',
          type: 'textarea',
          value: recordatorio.descripcion,
          placeholder: 'Descripción del recordatorio'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Actualizar',
          handler: async (data) => {
            if (data.hora && data.descripcion) {
              await this.actualizarRecordatorio(recordatorio.id!, data.hora, data.descripcion, recordatorio.notificationId!);
              return true;
            } else {
              this.mostrarToast('Por favor completa todos los campos', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async actualizarRecordatorio(id: string, hora: string, descripcion: string, notificationId: number) {
    try {
      const fechaHora = new Date(`${this.fechaSeleccionada}T${hora}`);

      const recordatorioActualizado: Partial<Recordatorio> = {
        hora: hora,
        descripcion: descripcion,
        timestamp: fechaHora.getTime()
      };

      // Actualizar en Firebase
      const recordatorioRef = doc(this.firestore, 'recordatorios', id);
      await updateDoc(recordatorioRef, recordatorioActualizado);

      // Cancelar notificación anterior
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });

      // Programar nueva notificación
      await this.programarNotificacion({
        fecha: this.fechaSeleccionada,
        hora: hora,
        descripcion: descripcion,
        timestamp: fechaHora.getTime(),
        notificationId: notificationId
      });

      this.mostrarToast('Recordatorio actualizado', 'success');
    } catch (error) {
      console.error('Error actualizando recordatorio:', error);
      this.mostrarToast('Error al actualizar recordatorio', 'danger');
    }
  }

  async eliminarRecordatorio(recordatorio: Recordatorio) {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: '¿Estás seguro de que quieres eliminar este recordatorio?',
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
            } catch (error) {
              console.error('Error eliminando recordatorio:', error);
              this.mostrarToast('Error al eliminar recordatorio', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    toast.present();
  }

  formatearHora(hora: string): string {
    return new Date(`2000-01-01T${hora}`).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}