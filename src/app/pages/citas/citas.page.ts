import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, query, where, getDocs } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AutheticationService } from 'src/app/services/authetication.service';

@Component({
  selector: 'app-citas',
  templateUrl: './citas.page.html',
  styleUrls: ['./citas.page.scss'],
  standalone: false,
})
export class CitasPage {
  veterinariosDisponibles: any[] = [];
  horariosDisponibles: string[] = [];
  mascotas: any[] = [];
  mostrarExito = false;

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
  ) {}

  async ngOnInit() {
    await this.cargarMascotas();
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nuevaCita.userId = user.uid;
      this.cargarVeterinariosDisponibles(this.fechaSeleccionada);
    }
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
      // Convertir la fecha a formato YYYY-MM-DD para comparación
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
    const user = this.authService.getCurrentUser();
    if (!user) return;
    
    const mascotasRef = collection(this.firestore, 'mascotas');
    const q = query(mascotasRef, where('userId', '==', user.uid));
    
    collectionData(q, { idField: 'id' }).subscribe((data) => {
      this.mascotas = data;
    });
  }

  formularioValido(): boolean {
    return !!this.nuevaCita.veterinarioId && 
           !!this.nuevaCita.fecha && 
           !!this.nuevaCita.hora && 
           !!this.nuevaCita.motivo;
  }

  async crearCita() {
    try {
      if (!this.formularioValido()) {
        const toast = await this.toastController.create({
          message: 'Por favor complete todos los campos requeridos',
          duration: 2000,
          color: 'warning'
        });
        await toast.present();
        return;
      }

      // Asegurar que la fecha esté en formato YYYY-MM-DD
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
      petId: '',
      userId: this.nuevaCita.userId
    };
    this.fechaSeleccionada = new Date().toISOString();
    this.horariosDisponibles = [];
  }
}