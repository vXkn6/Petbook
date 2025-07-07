import { Component, OnInit, ViewChild } from '@angular/core';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, query, where, getDocs, updateDoc, getDoc, deleteDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AutheticationService } from 'src/app/services/authetication.service';
import { Cita } from 'src/app/models/cita.model';
import { LocalNotifications } from '@capacitor/local-notifications';

interface Pet {
  id: string;
  name: string;
  speciesName: string;
  userId?: string;
}

interface CitaExtendida extends Cita {
  id?: string;
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
  todosLosVeterinarios: any[] = [];
  horariosDisponibles: string[] = [];
  mascotas: Pet[] = [];
  citasAgendadas: CitaExtendida[] = [];
  mostrarExito = false;
  modalDetalleVisible = false;
  citaSeleccionada: CitaExtendida | null = null;
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
    userId: '', // Ya presente, se inicializa en ngOnInit
    estado: 'pendiente'
  };

  fechaSeleccionada: string = new Date().toISOString();
  fechaMinima: string = new Date().toISOString();
  fechaMaxima: string = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString();

  constructor(
    private firestore: Firestore,
    private toastController: ToastController,
    private authService: AutheticationService,
    private alertController: AlertController
  ) { }

  async ngOnInit(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.uid;
      this.nuevaCita.userId = user.uid; // Asegura que el userId se asigne al crear una nueva cita
      await this.cargarMascotas();
      await this.verificarRolUsuario();
      await this.cargarTodosLosVeterinarios();
      await this.cargarCitasAgendadas();
      this.cargarVeterinariosDisponibles(this.fechaSeleccionada);
    }
  }

  async verificarRolUsuario(): Promise<void> {
    if (!this.currentUserId) return;

    const userRef = doc(this.firestore, 'users', this.currentUserId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      this.esAdmin = userData?.['role'] === 'admin';
    }
  }

  async cargarTodosLosVeterinarios(): Promise<void> {
    try {
      const veterinariosRef = collection(this.firestore, 'veterinarios');
      const querySnapshot = await getDocs(veterinariosRef);
      this.todosLosVeterinarios = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('Todos los veterinarios cargados:', this.todosLosVeterinarios.length);
    } catch (error) {
      console.error('Error al cargar veterinarios:', error);
    }
  }

  esOwner(cita: CitaExtendida): boolean {
    return cita.userId === this.currentUserId;
  }

  async cargarCitasAgendadas(): Promise<void> {
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
        q = query(collection(this.firestore, 'citas'));
      } else {
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

      this.citasAgendadas = await Promise.all(
        citasBasicas.map(async (cita) => {
          const citaExtendida: CitaExtendida = { ...cita };

          try {
            const userRef = doc(this.firestore, 'users', cita.userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              citaExtendida.usuarioEmail = userData['email'] || 'Email no disponible';
              citaExtendida.usuarioNombre = userData['username'] || userData['name'] || 'Nombre no disponible';
            }
          } catch (error) {
            console.error('Error al obtener usuario:', error);
            citaExtendida.usuarioEmail = 'Error al cargar email';
            citaExtendida.usuarioNombre = 'Error al cargar nombre';
          }

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
            citaExtendida.mascotaEspecie = 'Error al cargar especie';
          }

          try {
            const vet = this.todosLosVeterinarios.find(v => v.id === cita.veterinarioId);
            if (vet) {
              (citaExtendida as any).veterinarioNombreTemp = vet.nombre || 'Nombre no disponible';
              (citaExtendida as any).veterinarioEspecialidadTemp = vet.especialidad || 'Especialidad no disponible';
            } else {
              (citaExtendida as any).veterinarioNombreTemp = 'Veterinario no encontrado';
              (citaExtendida as any).veterinarioEspecialidadTemp = 'Especialidad no disponible';
            }
          } catch (error) {
            console.error('Error al obtener veterinario:', error);
            (citaExtendida as any).veterinarioNombreTemp = 'Error al cargar veterinario';
            (citaExtendida as any).veterinarioEspecialidadTemp = 'Error al cargar especialidad';
          }

          return citaExtendida;
        })
      );

      this.citasAgendadas.sort((a, b) => {
        if (a.estado === 'cancelada' && b.estado !== 'cancelada') return 1;
        if (a.estado !== 'cancelada' && b.estado === 'cancelada') return -1;
        const dateA = new Date(`${a.fecha}T${a.hora}`);
        const dateB = new Date(`${b.fecha}T${b.hora}`);
        return dateA.getTime() - dateB.getTime();
      });

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

  obtenerInfoMascotaCompleta(petId: string): string {
    const citaConMascota = this.citasAgendadas.find(c => c.petId === petId);
    if (citaConMascota?.mascotaNombre) {
      return `${citaConMascota.mascotaNombre} (${citaConMascota.mascotaEspecie})`;
    }

    const mascota = this.mascotas.find(m => m.id === petId);
    return mascota ? `${mascota.name} (${mascota.speciesName})` : 'Mascota no disponible';
  }

  puedeVerReceta(cita: CitaExtendida): boolean {
    return this.esAdmin || cita.userId === this.currentUserId;
  }

  obtenerNombreVeterinario(veterinarioId: string): string {
    const vet = this.todosLosVeterinarios.find(v => v.id === veterinarioId);
    return vet ? `${vet.nombre} (${vet.especialidad})` : 'Veterinario no disponible';
  }

  obtenerSoloNombreVeterinario(veterinarioId: string): string {
    const vet = this.todosLosVeterinarios.find(v => v.id === veterinarioId);
    return vet ? vet.nombre : 'Veterinario no disponible';
  }

  obtenerEspecialidadVeterinario(veterinarioId: string): string {
    const vet = this.todosLosVeterinarios.find(v => v.id === veterinarioId);
    return vet ? vet.especialidad : 'Especialidad no disponible';
  }

  obtenerNombreVeterinarioExtendido(cita: CitaExtendida): string {
    const nombreTemp = (cita as any).veterinarioNombreTemp;
    if (nombreTemp) {
      return nombreTemp;
    }

    if ((cita as any).veterinarioNombre) {
      return (cita as any).veterinarioNombre;
    }

    return this.obtenerSoloNombreVeterinario(cita.veterinarioId);
  }

  obtenerEspecialidadVeterinarioExtendido(cita: CitaExtendida): string {
    const especialidadTemp = (cita as any).veterinarioEspecialidadTemp;
    if (especialidadTemp) {
      return especialidadTemp;
    }

    if ((cita as any).veterinarioEspecialidad) {
      return (cita as any).veterinarioEspecialidad;
    }

    return this.obtenerEspecialidadVeterinario(cita.veterinarioId);
  }

  obtenerInfoVeterinarioCompleta(cita: CitaExtendida): string {
    const nombre = this.obtenerNombreVeterinarioExtendido(cita);
    const especialidad = this.obtenerEspecialidadVeterinarioExtendido(cita);
    return `${nombre} (${especialidad})`;
  }

  obtenerNombreMascota(petId: string): string {
    const mascota = this.mascotas.find(m => m.id === petId);
    return mascota ? `${mascota.name} (${mascota.speciesName})` : 'Mascota no disponible';
  }

  async mostrarDetalleCita(cita: CitaExtendida): Promise<void> {
    this.citaSeleccionada = cita;
    this.modalDetalleVisible = true;
  }

  cerrarModal(): void {
    this.modalDetalleVisible = false;
    this.citaSeleccionada = null;
  }

  seleccionarReceta(): void {
    this.fileInput.nativeElement.click();
  }

  async subirReceta(event: any): Promise<void> {
    if (!this.esAdmin || !this.citaSeleccionada?.id || this.citaSeleccionada?.estado === 'cancelada') return;

    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64 && this.citaSeleccionada?.id) {
        await updateDoc(doc(this.firestore, 'citas', this.citaSeleccionada.id), {
          recetaBase64: base64
        });
        this.mostrarToast('Receta subida correctamente', 'success');
        await this.cargarCitasAgendadas();

        if (this.modalDetalleVisible && this.citaSeleccionada?.id) {
          this.citaSeleccionada = await this.obtenerCitaCompleta(this.citaSeleccionada.id);
        }
      } else {
        console.warn('No se pudo procesar la receta: datos incompletos.');
        this.mostrarToast('Error: No se pudo subir la receta.', 'danger');
      }
    };
    reader.readAsDataURL(file);
  }

  async mostrarToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2000, color });
    await toast.present();
  }

  async cargarVeterinariosDisponibles(fecha: string): Promise<void> {
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

  async cargarHorariosDisponibles(): Promise<void> {
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
        where('fecha', '==', fechaFormateada),
        where('estado', '!=', 'cancelada')
      );

      const snapshot = await getDocs(q);
      const horariosOcupados = snapshot.docs.map(doc => doc.data()['hora']);

      return horarios.filter(hora => !horariosOcupados.includes(hora));
    } catch (error) {
      console.error('Error al filtrar horarios:', error);
      return horarios;
    }
  }

  actualizarFechaCita(event: any): void {
    this.nuevaCita.fecha = new Date(event.detail.value).toISOString().split('T')[0];
    this.cargarVeterinariosDisponibles(this.nuevaCita.fecha);
    this.nuevaCita.veterinarioId = '';
    this.nuevaCita.hora = '';
    this.horariosDisponibles = [];
  }

  async cargarMascotas(): Promise<void> {
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

  async crearCita(): Promise<void> {
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
      this.nuevaCita.estado = 'pendiente';

      const citasRef = collection(this.firestore, 'citas');
      const docRef = await addDoc(citasRef, this.nuevaCita);

      const citaCompleta = await this.obtenerCitaCompleta(docRef.id);
      await this.crearRecordatorioCalendario(citaCompleta); // Aquí se crea el recordatorio con estado

      this.mostrarExito = true;
      this.resetForm();
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

  resetForm(): void {
    this.nuevaCita = {
      veterinarioId: '',
      fecha: '',
      hora: '',
      motivo: '',
      petId: '',
      userId: this.authService.getCurrentUser()?.uid || '', // Asegura que el userId se mantenga
      estado: 'pendiente'
    };
    this.fechaSeleccionada = new Date().toISOString();
    this.horariosDisponibles = [];
    this.cargarVeterinariosDisponibles(this.fechaSeleccionada);
  }

  private async obtenerCitaCompleta(citaId: string): Promise<CitaExtendida> {
    const citaRef = doc(this.firestore, 'citas', citaId);
    const citaDoc = await getDoc(citaRef);

    if (!citaDoc.exists()) {
      throw new Error('La cita no existe');
    }

    const citaData = citaDoc.data() as Cita;
    const citaExtendida: CitaExtendida = { ...citaData, id: citaDoc.id };

    const userRef = doc(this.firestore, 'users', citaData.userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      citaExtendida.usuarioEmail = userData['email'] || 'Email no disponible';
      citaExtendida.usuarioNombre = userData['username'] || userData['name'] || 'Nombre no disponible';
    }

    const petRef = doc(this.firestore, 'pets', citaData.petId);
    const petDoc = await getDoc(petRef);
    if (petDoc.exists()) {
      const petData = petDoc.data();
      citaExtendida.mascotaNombre = petData['name'] || 'Nombre no disponible';
      citaExtendida.mascotaEspecie = petData['speciesName'] || 'Especie no disponible';
    }

    const vet = this.todosLosVeterinarios.find(v => v.id === citaData.veterinarioId);
    if (vet) {
      (citaExtendida as any).veterinarioNombreTemp = vet.nombre || 'Nombre no disponible';
      (citaExtendida as any).veterinarioEspecialidadTemp = vet.especialidad || 'Especialidad no disponible';
    }

    return citaExtendida;
  }

  private convertToUTCForStorage(dateString: string, timeString: string): { dateUTC: string, timestampUTC: number } {
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

  private async crearRecordatorioCalendario(cita: CitaExtendida): Promise<void> {
    try {
      if (!cita.id) {
        console.error('ID de cita no disponible para crear recordatorio');
        return;
      }
      const { dateUTC, timestampUTC } = this.convertToUTCForStorage(cita.fecha, cita.hora);
      const descripcion = `Cita para ${cita.mascotaNombre} con ${(cita as any).veterinarioNombreTemp} - Motivo: ${cita.motivo}`;

      const recordatorioParaFirebase = {
        fecha: dateUTC,
        hora: cita.hora,
        descripcion: descripcion,
        timestamp: timestampUTC,
        notificationId: parseInt(cita.id.replace(/\D/g, '').slice(-6), 10), // Puedes mejorar este ID si hay colisiones
        citaId: cita.id,
        estadoCita: cita.estado,
        userId: cita.userId // <-- ¡ESTA ES LA LÍNEA AÑADIDA / CORREGIDA!
      };
      const recordatoriosRef = collection(this.firestore, 'recordatorios');
      await addDoc(recordatoriosRef, recordatorioParaFirebase);

      const fechaNotificacionLocal = new Date(`${cita.fecha}T${cita.hora}`);
      await this.programarNotificacion({
        ...recordatorioParaFirebase,
        fecha: cita.fecha,
        hora: cita.hora,
        timestamp: fechaNotificacionLocal.getTime()
      });
      console.log('Recordatorio de cita creado con userId:', recordatorioParaFirebase.userId); // Para depuración
    } catch (error) {
      console.error('Error al crear recordatorio:', error);
    }
  }

  private async programarNotificacion(recordatorio: any): Promise<void> {
    try {
      const fechaNotificacion = new Date(`${recordatorio.fecha}T${recordatorio.hora}`);

      if (fechaNotificacion > new Date()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Recordatorio de Cita',
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

  private async programarNotificacionCancelacion(cita: CitaExtendida, motivo: string): Promise<void> {
    try {
      if (!cita.id) {
        console.error('ID de cita no disponible para programar notificación');
        return;
      }
      const notificationId = parseInt(cita.id.replace(/\D/g, '').slice(-6), 10) + 500000;
      await LocalNotifications.schedule({
        notifications: [
          {
            title: 'Cita Cancelada',
            body: `Tu cita para ${cita.mascotaNombre} con ${this.obtenerSoloNombreVeterinario(cita.veterinarioId)} el ${cita.fecha} a las ${cita.hora} ha sido cancelada. Motivo: ${motivo}. Contáctenos.`,
            id: notificationId,
            schedule: { at: new Date(Date.now() + 1000) },
            sound: 'default'
          }
        ]
      });
    } catch (error) {
      console.error('Error programando notificación de cancelación:', error);
    }
  }

  // --- MÉTODO PARA ACTUALIZAR ESTADO DE RECORDATORIO CANCELADO ---
  private async actualizarEstadoRecordatorioCancelado(citaId: string, motivoCancelacion: string): Promise<void> {
      try {
          if (!citaId) {
              console.error('ID de cita no disponible para actualizar recordatorio de cancelación.');
              return;
          }

          const recordatoriosRef = collection(this.firestore, 'recordatorios');
          const q = query(recordatoriosRef, where('citaId', '==', citaId));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
              const recordatorioDoc = querySnapshot.docs[0];
              const recordatorioId = recordatorioDoc.id;
              const recordatorioData = recordatorioDoc.data();

              // *** Se añade "CANCELADA" y el motivo a la descripción existente ***
              const nuevaDescripcion = `${recordatorioData['descripcion']} (CANCELADA - Motivo: ${motivoCancelacion})`;

              await updateDoc(doc(this.firestore, 'recordatorios', recordatorioId), {
                  descripcion: nuevaDescripcion,
                  estadoCita: 'cancelada' // *** Se establece el estado a 'cancelada' ***
              });

              // Opcional: Cancelar la notificación original si ya no es relevante
              if (recordatorioData['notificationId'] !== undefined) {
                  await LocalNotifications.cancel({ notifications: [{ id: recordatorioData['notificationId'] }] });
              }
          } else {
              console.warn(`No se encontró recordatorio asociado a la cita ${citaId} para actualizar su estado de cancelación.`);
          }
      } catch (error) {
          console.error('Error al actualizar el estado del recordatorio por cancelación:', error);
      }
  }

  // Se mantiene `eliminarRecordatorioCalendario` para otros usos si fuera necesario,
  // pero para `cancelarCita`, ahora usamos `actualizarEstadoRecordatorioCancelado`.
  private async eliminarRecordatorioCalendario(citaId: string): Promise<void> {
    try {
      if (!citaId) {
        console.error('ID de cita no disponible para eliminar recordatorio.');
        return;
      }

      const recordatoriosRef = collection(this.firestore, 'recordatorios');
      const q = query(recordatoriosRef, where('citaId', '==', citaId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const recordatorioDoc = querySnapshot.docs[0];
        const recordatorioData = recordatorioDoc.data();

        await deleteDoc(doc(this.firestore, 'recordatorios', recordatorioDoc.id));

        if (recordatorioData['notificationId'] !== undefined) {
          await LocalNotifications.cancel({ notifications: [{ id: recordatorioData['notificationId'] }] });
        }
      }
    } catch (error) {
      console.error('Error al eliminar recordatorio:', error);
    }
  }

  async eliminarCita(citaId: string): Promise<void> {
    try {
      if (!citaId) {
        this.mostrarToast('Error: ID de cita no disponible.', 'danger');
        return;
      }
      // Considera si realmente quieres eliminar el recordatorio del calendario si la cita se elimina de forma permanente
      // Si solo se cancela, se usa actualizarEstadoRecordatorioCancelado.
      // Si se elimina la cita por completo (ej: desde un admin), entonces sí se puede eliminar el recordatorio.
      await this.eliminarRecordatorioCalendario(citaId);
      await deleteDoc(doc(this.firestore, 'citas', citaId));

      this.mostrarToast('Cita eliminada correctamente', 'success');
      await this.cargarCitasAgendadas();
      this.cerrarModal();
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      this.mostrarToast('Error al eliminar la cita', 'danger');
    }
  }

  async cancelarCita(cita: CitaExtendida): Promise<void> {
    if (!this.esAdmin) {
      this.mostrarToast('No tienes permisos para cancelar citas.', 'danger');
      return;
    }

    if (!cita.id) {
      this.mostrarToast('Error: ID de cita no disponible.', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancelar Cita',
      message: 'Por favor, introduce el motivo de la cancelación:',
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Ej: El veterinario no está disponible, emergencia, etc.',
          attributes: {
            required: true
          }
        }
      ],
      buttons: [
        {
          text: 'Volver',
          role: 'cancel',
          cssClass: 'secondary',
          handler: () => {
            console.log('Cancelación de cita anulada');
            return true;
          }
        },
        {
          text: 'Confirmar Cancelación',
          handler: async (data) => {
            if (data.motivo && cita.id) {
              try {
                await updateDoc(doc(this.firestore, 'citas', cita.id), {
                  estado: 'cancelada',
                  motivoCancelacion: data.motivo
                });

                // *** CAMBIADO: Ahora llama a actualizarEstadoRecordatorioCancelado ***
                await this.actualizarEstadoRecordatorioCancelado(cita.id, data.motivo);
                await this.programarNotificacionCancelacion(cita, data.motivo);

                this.mostrarToast('Cita cancelada correctamente y usuario notificado.', 'success');
                this.cerrarModal();
                await this.cargarCitasAgendadas();
                return true;
              } catch (error) {
                console.error('Error al cancelar cita:', error);
                this.mostrarToast('Error al cancelar la cita', 'danger');
                return false;
              }
            } else {
              this.mostrarToast('Debes proporcionar un motivo para cancelar la cita.', 'warning');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async actualizarCita(citaId: string, nuevosDatos: any): Promise<void> {
    try {
      if (!citaId) {
        this.mostrarToast('Error: ID de cita no disponible para actualizar.', 'danger');
        return;
      }
      await updateDoc(doc(this.firestore, 'citas', citaId), nuevosDatos);

      const citaActualizada = await this.obtenerCitaCompleta(citaId);
      // Opcional: Si actualizas la cita de otras formas, considera actualizar el recordatorio aquí también
      // await this.actualizarRecordatorioCalendario(citaActualizada);

      this.mostrarToast('Cita actualizada correctamente', 'success');
      await this.cargarCitasAgendadas();
    } catch (error) {
      console.error('Error al actualizar cita:', error);
      this.mostrarToast('Error al actualizar la cita', 'danger');
    }
  }

  async debugInfo(): Promise<void> {
    console.log('=== DEBUG INFO ===');
    console.log('currentUserId:', this.currentUserId);
    console.log('esAdmin:', this.esAdmin);
    console.log('citasAgendadas:', this.citasAgendadas);
    console.log('todosLosVeterinarios:', this.todosLosVeterinarios);
    console.log('==================');
  }
}