import { Component, OnInit, ViewChild } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, query, where, getDocs, updateDoc, getDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AutheticationService } from 'src/app/services/authetication.service';
import { Cita } from 'src/app/models/cita.model';


interface Pet {
  id: string;
  name: string;
  speciesName: string; 
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
  citasAgendadas: Cita[] = [];
  mostrarExito = false;
  modalDetalleVisible = false;
  citaSeleccionada: Cita | null = null;
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
    private authService: AutheticationService
  ) { }

  async ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
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

  esOwner(cita: Cita): boolean {
    return cita.userId === this.currentUserId;
  }

  async cargarCitasAgendadas() {
    let q;
    if (this.esAdmin) {
      // Admin ve todas las citas
      q = query(collection(this.firestore, 'citas'));
    } else {
      // Owner solo ve sus citas
      q = query(
        collection(this.firestore, 'citas'),
        where('userId', '==', this.currentUserId)
      );
    }

    const querySnapshot = await getDocs(q);
    this.citasAgendadas = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Cita));
  }

  puedeVerReceta(cita: Cita): boolean {
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

  async mostrarDetalleCita(cita: Cita) {
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
      // Si había un veterinario seleccionado que ya no está disponible, lo limpiamos
      if (this.nuevaCita.veterinarioId && !this.veterinariosDisponibles.some(v => v.id === this.nuevaCita.veterinarioId)) {
        this.nuevaCita.veterinarioId = '';
        this.horariosDisponibles = [];
      }
      // Si ya hay un veterinario seleccionado, recargar sus horarios para la nueva fecha
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
      // Filtrar horarios que no estén ya ocupados en otras citas
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
      // Convertir la fecha a formato ISO (YYYY-MM-DD) para comparación
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
      return horarios; // Si hay error, mostramos todos los horarios
    }
  }

  actualizarFechaCita(event: any) {
    this.nuevaCita.fecha = new Date(event.detail.value).toISOString().split('T')[0];
    this.cargarVeterinariosDisponibles(this.nuevaCita.fecha);
    this.nuevaCita.veterinarioId = ''; // Resetear veterinario al cambiar fecha
    this.nuevaCita.hora = ''; // Resetear hora al cambiar fecha
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
          userId: data['userId'] // Asegurar que userId está incluido
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
      !!this.nuevaCita.petId; // Validación agregada para petId
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

      // Asegurar que la fecha esté en formato ISO (YYYY-MM-DD)
      this.nuevaCita.fecha = new Date(this.nuevaCita.fecha).toISOString().split('T')[0];

      const citasRef = collection(this.firestore, 'citas');
      await addDoc(citasRef, this.nuevaCita);

      this.mostrarExito = true;
      this.resetForm();
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
      petId: '', // Asegúrate de resetear petId
      userId: this.authService.getCurrentUser()?.uid || '' // Mantén el userId si está logueado
    };
    this.fechaSeleccionada = new Date().toISOString();
    this.horariosDisponibles = [];
    this.cargarVeterinariosDisponibles(this.fechaSeleccionada); // Recarga veterinarios al resetear
  }
}