import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, collectionData, query, orderBy, where } from '@angular/fire/firestore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Subscription } from 'rxjs'; // Necesario para desuscribirse
import { AutheticationService } from '../../services/authetication.service'; 

export interface Recordatorio {
  id?: string;
  fecha: string;        // Formato YYYY-MM-DD (UTC)
  hora: string;         // Formato HH:MM (24h)
  descripcion: string;
  timestamp: number;    // Timestamp en UTC
  notificationId?: number;
  citaId?: string;      // Campo para vincular con la cita
  estadoCita?: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
  userId: string;       // ¡NUEVO CAMPO! Para almacenar el ID del usuario
}

@Component({
  selector: 'app-calendario',
  templateUrl: './calendario.page.html',
  styleUrls: ['./calendario.page.scss'],
  standalone: false
})
export class CalendarioPage implements OnInit, OnDestroy { // Implementamos OnDestroy
  fechaSeleccionada: string = '';
  recordatorios: Recordatorio[] = [];
  recordatoriosFiltrados: Recordatorio[] = [];
  loading = true;

  private currentUserUid: string | null = null;
  private userSubscription: Subscription | undefined; // Para manejar la suscripción del usuario

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private firestore: Firestore,
    private authService: AutheticationService // Inyectamos tu servicio de autenticación
  ) {
    const hoy = new Date();
    this.fechaSeleccionada = this.formatLocalDate(hoy);
  }

  async ngOnInit(): Promise<void> {
    await LocalNotifications.requestPermissions();

    // Nos suscribimos a los cambios de autenticación para obtener el UID del usuario
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserUid = user.uid;
        this.cargarRecordatorios(); // Cargar recordatorios una vez que el usuario está disponible
      } else {
        this.currentUserUid = null;
        this.recordatorios = [];
        this.recordatoriosFiltrados = [];
        this.loading = false;
        // Opcional: Podrías redirigir al usuario a la página de login si no está autenticado
        // this.router.navigateByUrl('/login');
        this.mostrarToast('Debes iniciar sesión para ver tus recordatorios.', 'warning');
      }
    });
  }

  // Importante: Desuscribirse para evitar fugas de memoria
  ngOnDestroy(): void {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

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
      dateUTC: utcDate.toISOString().split('T')[0],
      timestampUTC: utcDate.getTime()
    };
  }

  async requestNotificationPermissions(): Promise<void> {
    try {
      await LocalNotifications.requestPermissions();
    } catch (error) {
      console.error('Error al solicitar permisos:', error);
    }
  }

  cargarRecordatorios(): void {
    // Si no hay un usuario logueado, limpiamos y salimos
    if (!this.currentUserUid) {
      this.recordatorios = [];
      this.recordatoriosFiltrados = [];
      this.loading = false;
      return;
    }

    this.loading = true;
    const recordatoriosRef = collection(this.firestore, 'recordatorios');
    // Filtramos los recordatorios para que solo se muestren los del usuario actual
    const q = query(
      recordatoriosRef,
      where('userId', '==', this.currentUserUid), // ¡FILTRO CLAVE!
      orderBy('timestamp', 'asc')
    );

    collectionData(q, { idField: 'id' }).subscribe({
      next: (recordatorios: any[]) => {
        this.recordatorios = recordatorios.map(r => ({
          ...r,
          fecha: r.fecha.split('T')[0],
          estadoCita: r.estadoCita,
          userId: r.userId // Aseguramos que userId también se mapea
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

  onFechaSeleccionada(event: any): void {
    if (event?.detail?.value) {
      this.fechaSeleccionada = event.detail.value.split('T')[0];
      console.log('Fecha seleccionada (local):', this.fechaSeleccionada);
      this.filtrarRecordatoriosPorFecha();
    }
  }

  filtrarRecordatoriosPorFecha(): void {
    if (!this.recordatorios || !this.fechaSeleccionada) {
      this.recordatoriosFiltrados = [];
      return;
    }

    const { dateUTC } = this.convertToUTC(this.fechaSeleccionada, '00:00');

    this.recordatoriosFiltrados = this.recordatorios.filter(
      recordatorio => recordatorio.fecha === dateUTC
    );
  }

  async crearRecordatorio(): Promise<void> {
    // Verificar si hay un usuario logueado antes de permitir la creación
    if (!this.currentUserUid) {
      this.mostrarToast('Debes iniciar sesión para crear recordatorios.', 'warning');
      return;
    }

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

  async guardarRecordatorio(hora: string, descripcion: string): Promise<void> {
    // Doble verificación del usuario logueado
    if (!this.currentUserUid) {
      this.mostrarToast('Error: No hay usuario logueado para guardar el recordatorio.', 'danger');
      return;
    }

    try {
      const { dateUTC, timestampUTC } = this.convertToUTC(this.fechaSeleccionada, hora);
      const notificationId = Date.now(); // Genera un ID de notificación único

      const recordatorio: Recordatorio = {
        fecha: dateUTC,
        hora: hora,
        descripcion: descripcion,
        timestamp: timestampUTC,
        notificationId: notificationId,
        userId: this.currentUserUid, // ¡ASIGNA EL ID DEL USUARIO ACTUAL!
        // No se asigna citaId ni estadoCita aquí, ya que es un recordatorio manual
      };

      const recordatoriosRef = collection(this.firestore, 'recordatorios');
      await addDoc(recordatoriosRef, recordatorio);

      // Programar notificación
      await this.programarNotificacion({
        ...recordatorio,
        fecha: this.fechaSeleccionada // Usa la fecha local para programar la notificación
      });

      this.mostrarToast('Recordatorio guardado', 'success');
      // La carga de recordatorios se manejará automáticamente por la suscripción a Firestore
    } catch (error) {
      console.error('Error al guardar recordatorio:', error);
      this.mostrarToast('Error al guardar', 'danger');
    }
  }

  async programarNotificacion(recordatorio: Recordatorio): Promise<void> {
    try {
      const fechaNotificacion = new Date(`${recordatorio.fecha}T${recordatorio.hora}`);

      if (fechaNotificacion > new Date() && recordatorio.notificationId !== undefined) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Recordatorio',
              body: recordatorio.descripcion,
              id: recordatorio.notificationId,
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

  async editarRecordatorio(recordatorio: Recordatorio): Promise<void> {
    // Deshabilita la edición si es un recordatorio de cita (para manejarlo en la sección de citas)
    if (recordatorio.citaId) {
      this.mostrarToast('Este recordatorio está asociado a una cita y debe ser editado desde la sección de Citas.', 'warning');
      return;
    }
    // Aseguramos que solo el propietario pueda editar
    if (recordatorio.userId !== this.currentUserUid) {
        this.mostrarToast('No tienes permiso para editar este recordatorio.', 'danger');
        return;
    }

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

  async actualizarRecordatorio(id: string, hora: string, descripcion: string, notificationId: number): Promise<void> {
    try {
      const { dateUTC, timestampUTC } = this.convertToUTC(this.fechaSeleccionada, hora);

      const recordatorioActualizado: Partial<Recordatorio> = {
        fecha: dateUTC,
        hora: hora,
        descripcion: descripcion,
        timestamp: timestampUTC
      };

      const recordatorioRef = doc(this.firestore, 'recordatorios', id);
      await updateDoc(recordatorioRef, recordatorioActualizado);

      // Cancelar y reprogramar la notificación
      if (notificationId !== undefined) {
        await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      }
      await this.programarNotificacion({
        ...recordatorioActualizado,
        fecha: this.fechaSeleccionada,
        notificationId: notificationId,
        userId: this.currentUserUid! // Aseguramos que el userId esté presente para programar
      } as Recordatorio);

      this.mostrarToast('Recordatorio actualizado', 'success');
      // La carga de recordatorios se manejará automáticamente
    } catch (error) {
      console.error('Error al actualizar recordatorio:', error);
      this.mostrarToast('Error al actualizar', 'danger');
    }
  }

  async eliminarRecordatorio(recordatorio: Recordatorio): Promise<void> {
    // Deshabilita la eliminación si es un recordatorio de cita (para manejarlo en la sección de citas)
    if (recordatorio.citaId) {
      this.mostrarToast('Este recordatorio está asociado a una cita y no puede ser eliminado desde aquí. Cancele la cita para eliminar el recordatorio.', 'warning');
      return;
    }
    // Aseguramos que solo el propietario pueda eliminar
    if (recordatorio.userId !== this.currentUserUid) {
        this.mostrarToast('No tienes permiso para eliminar este recordatorio.', 'danger');
        return;
    }

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
              const recordatorioRef = doc(this.firestore, 'recordatorios', recordatorio.id!);
              await deleteDoc(recordatorioRef);

              if (recordatorio.notificationId !== undefined) {
                await LocalNotifications.cancel({
                  notifications: [{ id: recordatorio.notificationId }]
                });
              }

              this.mostrarToast('Recordatorio eliminado', 'success');
              // La carga de recordatorios se manejará automáticamente
            } catch (error) {
              console.error('Error al eliminar recordatorio:', error);
              this.mostrarToast('Error al eliminar', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async mostrarToast(mensaje: string, color: string): Promise<void> {
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

  formatearFecha(fechaUTC: string): string {
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