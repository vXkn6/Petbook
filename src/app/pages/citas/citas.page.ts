import { Component, OnInit, ViewChild } from '@angular/core';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, query, where, getDocs, updateDoc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AutheticationService } from 'src/app/services/authetication.service';
import { Cita } from 'src/app/models/cita.model';
import OneSignal from 'onesignal-cordova-plugin';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';


// Interfaz para mascotas
interface Pet {
  id: string;
  name: string;
  speciesName: string;
  userId?: string;
}

// Interfaz extendida para citas con información adicional
interface CitaExtendida extends Cita {
  usuarioEmail?: string;
  usuarioNombre?: string;
  mascotaNombre?: string;
  mascotaEspecie?: string;
}

@Component({
  selector: 'app-citas',
  templateUrl: './citas.page.html',
  styleUrls: ['./citas.page.scss'],
  standalone: false,
})
export class CitasPage implements OnInit {

  @ViewChild('fileInput') fileInput: any;

  viewMode: 'nueva' | 'agendadas' = 'nueva';
  veterinariosDisponibles: any[] = [];
  horariosDisponibles: string[] = [];
  mascotas: Pet[] = [];
  citasAgendadas: CitaExtendida[] = []; // Cambiado a CitaExtendida
  mostrarExito = false;
  modalDetalleVisible = false;
  citaSeleccionada: CitaExtendida | null = null; // Cambiado a CitaExtendida
  esAdmin: boolean = false;
  currentUserId: string | null = null;

  alertButtons = [
    {
      text: 'OK',
      role: 'confirm',
      handler: () => {
        console.log('Alerta confirmada');
      }
    }
  ];

  nuevaCita: any = {
    veterinarioId: '',
    fecha: '',
    hora: '',
    motivo: '',
    petId: '',
    userId: ''
  };

  fechaSeleccionada: string = new Date().toISOString();
  fechaMinima: string = new Date().toISOString();
  fechaMaxima: string = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

  constructor(
    private firestore: Firestore,
    private toastController: ToastController,
    private authService: AutheticationService,
    private alertController: AlertController,
    private http: HttpClient,
  ) { }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.uid;
      this.nuevaCita.userId = user.uid;
      await this.cargarMascotas();
      await this.verificarRolUsuario();
      await this.cargarCitasAgendadas();
      this.cargarVeterinariosDisponibles(this.fechaSeleccionada);
    }
  }

  async verificarRolUsuario() {
    if (!this.currentUserId) return;

    const userRef = doc(this.firestore, 'users', this.currentUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      this.esAdmin = userData?.['role'] === 'admin';
    }
  }

  esOwner(cita: CitaExtendida): boolean {
    return cita.userId === this.currentUserId;
  }

  // Método actualizado para cargar citas con información completa
  async cargarCitasAgendadas() {
    try {
      let q;

      const currentUser = this.authService.getCurrentUser();
      const userId = this.currentUserId || currentUser?.uid;

      if (!userId) {
        console.warn('No hay usuario para cargar citas');
        this.citasAgendadas = [];
        return;
      }

      if (this.esAdmin) {
        // Admin ve todas las citas
        q = query(collection(this.firestore, 'citas'));
      } else {
        // Owner solo ve sus citas
        q = query(
          collection(this.firestore, 'citas'),
          where('userId', '==', userId)
        );
      }

      const querySnapshot = await getDocs(q);
      const citasBasicas = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Cita));

      // Enriquecer cada cita con información del usuario y mascota
      this.citasAgendadas = await Promise.all(
        citasBasicas.map(async (cita) => {
          const citaExtendida: CitaExtendida = { ...cita };

          // Obtener información del usuario
          try {
            const userRef = doc(this.firestore, 'users', cita.userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              citaExtendida.usuarioEmail = userData['email'] || 'Email no disponible';
              citaExtendida.usuarioNombre = userData['name'] || userData['nombre'] || 'Nombre no disponible';
            }
          } catch (error) {
            console.error('Error al obtener usuario:', error);
            citaExtendida.usuarioEmail = 'Error al cargar email';
          }

          // Obtener información de la mascota
          try {
            const petRef = doc(this.firestore, 'pets', cita.petId);
            const petDoc = await getDoc(petRef);
            if (petDoc.exists()) {
              const petData = petDoc.data();
              citaExtendida.mascotaNombre = petData['name'] || 'Nombre no disponible';
              citaExtendida.mascotaEspecie = petData['speciesName'] || 'Especie no disponible';
            }
          } catch (error) {
            console.error('Error al obtener mascota:', error);
            citaExtendida.mascotaNombre = 'Error al cargar mascota';
          }

          return citaExtendida;
        })
      );

      console.log('Citas cargadas con información completa:', this.citasAgendadas.length);

    } catch (error) {
      console.error('Error al cargar citas:', error);
      const toast = await this.toastController.create({
        message: 'Error al cargar las citas agendadas',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  // Métodos helper para obtener información en el template
  obtenerEmailUsuario(cita: CitaExtendida): string {
    return cita.usuarioEmail || 'Email no disponible';
  }

  obtenerNombreUsuario(cita: CitaExtendida): string {
    return cita.usuarioNombre || 'Usuario no disponible';
  }

  obtenerInfoMascota(cita: CitaExtendida): string {
    if (cita.mascotaNombre && cita.mascotaEspecie) {
      return `${cita.mascotaNombre} (${cita.mascotaEspecie})`;
    }
    return cita.mascotaNombre || 'Mascota no disponible';
  }

  // Método actualizado para compatibilidad
  obtenerInfoMascotaCompleta(petId: string): string {
    // Primero buscar en las citas cargadas
    const citaConMascota = this.citasAgendadas.find(c => c.petId === petId);
    if (citaConMascota?.mascotaNombre) {
      return `${citaConMascota.mascotaNombre} (${citaConMascota.mascotaEspecie})`;
    }

    // Fallback al método original
    const mascota = this.mascotas.find(m => m.id === petId);
    return mascota ? `${mascota.name} (${mascota.speciesName})` : 'Mascota no disponible';
  }

  puedeVerReceta(cita: CitaExtendida): boolean {
    return this.esAdmin || cita.userId === this.currentUserId;
  }

  obtenerNombreVeterinario(veterinarioId: string): string {
    const vet = this.veterinariosDisponibles.find(v => v.id === veterinarioId);
    return vet ? `${vet.nombre} (${vet.especialidad})` : 'Veterinario no disponible';
  }

  obtenerNombreMascota(petId: string): string {
    const mascota = this.mascotas.find(m => m.id === petId);
    return mascota ? `${mascota.name} (${mascota.speciesName})` : 'Mascota no disponible';
  }

  async mostrarDetalleCita(cita: CitaExtendida) {
    this.citaSeleccionada = cita;
    this.modalDetalleVisible = true;
  }

  cerrarModal() {
    this.modalDetalleVisible = false;
    this.citaSeleccionada = null;
  }

  seleccionarReceta() {
    this.fileInput.nativeElement.click();
  }

  async subirReceta(event: any) {
    if (!this.esAdmin || !this.citaSeleccionada?.id) return;

    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64) {
        await updateDoc(doc(this.firestore, 'citas', this.citaSeleccionada!.id!), {
          recetaBase64: base64
        });
        this.mostrarToast('Receta subida correctamente', 'success');
        this.cargarCitasAgendadas();
      }
    };
    reader.readAsDataURL(file);
  }

  async mostrarToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 2000, color });
    await toast.present();
  }

  async cargarVeterinariosDisponibles(fecha: string) {
    const fechaObj = new Date(fecha);
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[fechaObj.getDay()];

    const veterinariosRef = collection(this.firestore, 'veterinarios');
    const q = query(veterinariosRef,
      where('diasLaborales', 'array-contains', diaSemana),
      where('disponible', '==', true)
    );

    collectionData(q, { idField: 'id' }).subscribe((data) => {
      this.veterinariosDisponibles = data;
      if (this.nuevaCita.veterinarioId && !this.veterinariosDisponibles.some(v => v.id === this.nuevaCita.veterinarioId)) {
        this.nuevaCita.veterinarioId = '';
        this.horariosDisponibles = [];
      }
      if (this.nuevaCita.veterinarioId) {
        this.cargarHorariosDisponibles();
      }
    });
  }

  async cargarHorariosDisponibles() {
    if (!this.nuevaCita.veterinarioId || !this.fechaSeleccionada) {
      this.horariosDisponibles = [];
      return;
    }

    const fechaObj = new Date(this.fechaSeleccionada);
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[fechaObj.getDay()];

    const veterinario = this.veterinariosDisponibles.find(v => v.id === this.nuevaCita.veterinarioId);

    if (veterinario && veterinario.horariosLaborales && veterinario.horariosLaborales[diaSemana]) {
      this.horariosDisponibles = await this.filtrarHorariosOcupados(
        veterinario.horariosLaborales[diaSemana],
        this.nuevaCita.veterinarioId,
        this.fechaSeleccionada
      );
    } else {
      this.horariosDisponibles = [];
    }
  }

  async filtrarHorariosOcupados(horarios: string[], veterinarioId: string, fecha: string): Promise<string[]> {
    try {
      const fechaFormateada = new Date(fecha).toISOString().split('T')[0];

      const citasRef = collection(this.firestore, 'citas');
      const q = query(
        citasRef,
        where('veterinarioId', '==', veterinarioId),
        where('fecha', '==', fechaFormateada)
      );

      const snapshot = await getDocs(q);
      const horariosOcupados = snapshot.docs.map(doc => doc.data()['hora']);

      return horarios.filter(hora => !horariosOcupados.includes(hora));
    } catch (error) {
      console.error('Error al filtrar horarios:', error);
      return horarios;
    }
  }

  actualizarFechaCita(event: any) {
    this.nuevaCita.fecha = new Date(event.detail.value).toISOString().split('T')[0];
    this.cargarVeterinariosDisponibles(this.nuevaCita.fecha);
    this.nuevaCita.veterinarioId = '';
    this.nuevaCita.hora = '';
    this.horariosDisponibles = [];
  }

  async cargarMascotas() {
    if (!this.currentUserId) {
      this.mascotas = [];
      return;
    }

    const petsRef = collection(this.firestore, 'pets');
    const q = query(petsRef, where('userId', '==', this.currentUserId));

    try {
      const querySnapshot = await getDocs(q);
      this.mascotas = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data['name'],
          speciesName: data['speciesName'],
          userId: data['userId']
        } as Pet;
      });
    } catch (error) {
      console.error('Error al cargar mascotas:', error);
      const toast = await this.toastController.create({
        message: 'Error al cargar tus mascotas.',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  formularioValido(): boolean {
    return !!this.nuevaCita.veterinarioId &&
      !!this.nuevaCita.fecha &&
      !!this.nuevaCita.hora &&
      !!this.nuevaCita.motivo &&
      !!this.nuevaCita.petId;
  }

  async crearCita() {
    try {
      if (!this.formularioValido()) {
        const toast = await this.toastController.create({
          message: 'Por favor, completa todos los campos requeridos, incluyendo la mascota.',
          duration: 2000,
          color: 'warning'
        });
        await toast.present();
        return;
      }

      this.nuevaCita.fecha = new Date(this.nuevaCita.fecha).toISOString().split('T')[0];

      const citasRef = collection(this.firestore, 'citas');
      await addDoc(citasRef, this.nuevaCita);

      this.mostrarExito = true;
      this.resetForm();

      // Recargar las citas para mostrar la nueva
      await this.cargarCitasAgendadas();
    } catch (error) {
      console.error('Error al crear cita:', error);
      const toast = await this.toastController.create({
        message: 'Error al agendar la cita',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  resetForm() {
    this.nuevaCita = {
      veterinarioId: '',
      fecha: '',
      hora: '',
      motivo: '',
      petId: '',
      userId: this.authService.getCurrentUser()?.uid || ''
    };
    this.fechaSeleccionada = new Date().toISOString();
    this.horariosDisponibles = [];
    this.cargarVeterinariosDisponibles(this.fechaSeleccionada);
  }

  // Método de debug opcional
  async debugInfo() {
    console.log('=== DEBUG INFO ===');
    console.log('currentUserId:', this.currentUserId);
    console.log('esAdmin:', this.esAdmin);
    console.log('citasAgendadas:', this.citasAgendadas);
    console.log('==================');
  }

  async confirmarCancelacion(cita: any) {
    const alert = await this.alertController.create({
      header: 'Cancelar cita',
      message: 'Por favor, ingresa el motivo de la cancelación',
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Ej: Veterinario no disponible'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: data => {
            const motivo = data.motivo?.trim();
            if (motivo) {
              this.cancelarCita(cita, motivo);
              return true; // ← esto evita el error
            } else {
              this.mostrarToast('Debes ingresar un motivo', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async cancelarCita(cita: any, motivo: string) {
    try {
      const citaRef = doc(this.firestore, 'citas', cita.id);
      await updateDoc(citaRef, {
        estado: 'cancelada',
        motivoCancelacion: motivo // Nuevo campo en el documento
      });

      this.mostrarToast('Cita cancelada exitosamente', 'success');

      // Enviar notificación si es admin
      if (this.esAdmin && cita.userId) {
        this.enviarNotificacionCancelacion(cita.userId, cita, motivo);
      }

      // Actualizar lista
      this.cargarCitasAgendadas();

    } catch (error) {
      console.error('Error al cancelar cita:', error);
      this.mostrarToast('Error al cancelar cita', 'danger');
    }
  }

  enviarNotificacionCancelacion(userId: string, cita: any, motivo: string) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': environment.onesignal.restApiKey
    };

    const body = {
      app_id: environment.onesignal.appId,
      include_external_user_ids: [userId],
      channel_for_external_user_ids: 'push',
      headings: { en: 'Cita cancelada' },
      contents: {
        en: `Tu cita del ${cita.fecha} a las ${cita.hora} fue cancelada por la Veterinaria .\nMotivo: ${motivo}`
      }
    };

    this.http.post('https://onesignal.com/api/v1/notifications', body, { headers })
      .subscribe({
        next: () => console.log('✅ Notificación enviada'),
        error: (err) => console.error('❌ Error al enviar notificación', err)
      });
  }
  refrescarCitasEvent(event: any) {
    this.cargarCitasAgendadas().then(() => {
      event.target.complete(); // Finaliza la animación
    });
  }
}