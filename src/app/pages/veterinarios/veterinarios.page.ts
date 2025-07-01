import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController, LoadingController, ModalController, } from '@ionic/angular';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, deleteDoc, getDoc, getFirestore } from '@angular/fire/firestore';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { addIcons } from 'ionicons';
import { add, camera, close, medical, paw, pencil, save, trash } from 'ionicons/icons';
import { AutheticationService } from 'src/app/services/authetication.service';

@Component({
  selector: 'app-veterinarios',
  templateUrl: './veterinarios.page.html',
  styleUrls: ['./veterinarios.page.scss'],
  standalone: false,
})

export class VeterinariosPage {

  constructor(private alertController: AlertController, private toastController: ToastController, private loadingController: LoadingController, private modalCtrl: ModalController,
  ) {
    addIcons({ medical, pencil, trash, paw, add, close, camera, save });
    this.loadVeterinarios();

  }

  userEmail: string | null = null;
  userRole: string | null = null;
  userName: string | null = null;

  private authService = inject(AutheticationService);

  diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes',];
  horariosDisponibles: string[] = [
    '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00',
    '16:00', '17:00', '18:00'
  ];
  diaSeleccionado: string = this.diasSemana[0]; // Día inicial seleccionado
  veterinariosFiltrados: any[] = []

  private firestore: Firestore = inject(Firestore);
  private storage: Storage = inject(Storage);

  isModalOpen = false;
  showActionSheet = false;

  veterinarios: any[] = [];
  especialidades: any[] = [];

  nuevoVeterinario: any = {
    nombre: '',
    especialidad: '',
    foto: '',
    diasLaborales: [],
    horariosLaborales: {},
    disponible: true
  };

  editMode = false;
  editingId: string | null = null;

  async ngOnInit() {
    await this.loadEspecialidades(); // Cargar especialidades al iniciar
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userEmail = user.email;

    }
    if (user) {
      if (user) {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        this.userRole = userDoc.data()?.['role'] || null;
      }
    }
    if (user) {
      if (user) {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        this.userName = userDoc.data()?.['name'] || null;
      }
    }

  }

  async loadEspecialidades() {
    try {
      const especialidadesRef = collection(this.firestore, 'especialidades');
      collectionData(especialidadesRef, { idField: 'id' }).subscribe({
        next: (data) => {
          // ORDENAMIENTO ALFABÉTICO AQUÍ
          this.especialidades = data.sort((a, b) => a['nombre'].localeCompare(b['nombre']));
        },
        error: async (err) => {
          console.error('Error al cargar especialidades:', err);
          const toast = await this.toastController.create({
            message: 'Error al cargar especialidades',
            duration: 2000,
            color: 'danger'
          });
          await toast.present();
        }
      });
    } catch (error) {
      console.error('Error inesperado:', error);
    }
  }

  async loadVeterinarios() {
    const veterinariosRef = collection(this.firestore, 'veterinarios');
    collectionData(veterinariosRef, { idField: 'id' }).subscribe((data) => {
      this.veterinarios = data;
      this.filtrarVeterinarios(); // Filtramos los veterinarios al cargarlos

    });
  }

  filtrarVeterinarios() {
    if (!this.diaSeleccionado) return;

    this.veterinariosFiltrados = this.veterinarios.filter(vet => {
      return this.trabajaEsteDia(vet, this.diaSeleccionado);
    });
  }

  // Método auxiliar para verificar si trabaja un día
  trabajaEsteDia(veterinario: any, dia: string): boolean {
    if (!veterinario.diasLaborales) return false;

    // Si es array
    if (Array.isArray(veterinario.diasLaborales)) {
      return veterinario.diasLaborales.includes(dia);
    }

    // Si es objeto (del formulario)
    if (typeof veterinario.diasLaborales === 'object') {
      return !!veterinario.diasLaborales[dia];
    }

    return false;
  }

  // Método para mostrar por día en la vista
  mostrarVeterinariosDia(dia: string): any[] {
    return this.veterinarios.filter(vet => this.trabajaEsteDia(vet, dia));
  }

  // Método para abreviar días
  obtenerAbreviaturaDia(dia: string): string {
    return dia.substring(0, 3);
  }

  async agregarVeterinario() {
    // Convertir días y horarios laborales
    const diasArray = this.diasSemana.filter(dia =>
      this.nuevoVeterinario.diasLaborales[dia]
    );

    // Crear objeto de horarios para cada día
    const horariosObj: any = {};
    diasArray.forEach(dia => {
      horariosObj[dia] = this.nuevoVeterinario.horariosLaborales[dia] || [];
    });

    const veterinarioParaGuardar = {
      ...this.nuevoVeterinario,
      diasLaborales: diasArray,
      horariosLaborales: horariosObj
    };

    const veterinariosRef = collection(this.firestore, 'veterinarios');
    await addDoc(veterinariosRef, veterinarioParaGuardar);
    this.resetForm();
    this.isModalOpen = false;
  }

  async actualizarVeterinario() {
    if (!this.editingId) return;

    // Convertir días y horarios laborales
    const diasArray = this.convertirDiasLaborales(this.nuevoVeterinario.diasLaborales);

    // Crear objeto de horarios para cada día
    const horariosObj: any = {};
    diasArray.forEach(dia => {
      horariosObj[dia] = this.nuevoVeterinario.horariosLaborales[dia] || [];
    });

    const veterinarioParaActualizar = {
      ...this.nuevoVeterinario,
      diasLaborales: diasArray,
      horariosLaborales: horariosObj
    };

    const veterinarioRef = doc(this.firestore, 'veterinarios', this.editingId);
    await updateDoc(veterinarioRef, veterinarioParaActualizar);

    this.resetForm();
    this.isModalOpen = false;
  }

  private convertirDiasLaborales(dias: any): string[] {
    if (Array.isArray(dias)) {
      return dias;
    }
    // Si es un objeto (del formulario), convertirlo a array
    if (typeof dias === 'object' && dias !== null) {
      return this.diasSemana.filter(dia => dias[dia]);
    }
    // Si no es ni array ni objeto, devolver array vacío
    return [];
  }

  async eliminarVeterinario(id: string) {
    try {
      const veterinarioRef = doc(this.firestore, 'veterinarios', id);
      await deleteDoc(veterinarioRef);

      const toast = await this.toastController.create({
        message: 'Veterinario eliminado correctamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      console.error('Error al eliminar veterinario:', error);
      const toast = await this.toastController.create({
        message: 'Error al eliminar veterinario',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  async confirmarEliminacion(veterinario: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: `¿Estás seguro de eliminar a ${veterinario.nombre}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            await this.eliminarVeterinario(veterinario.id);
          }
        }
      ]
    });

    await alert.present();
  }

  editarVeterinario(veterinario: any) {
    this.editMode = true;
    this.editingId = veterinario.id;
    this.nuevoVeterinario = { ...veterinario };
  }

  resetForm() {
    this.nuevoVeterinario = {
      nombre: '',
      especialidad: '',
      foto: '',
      diasLaborales: [],
      horariosLaborales: {}, // Nuevo campo
      disponible: true
    };
    this.editMode = false;
    this.editingId = null;
  }

  toggleDiaLaboral(dia: string) {
    const index = this.nuevoVeterinario.diasLaborales.indexOf(dia);
    if (index > -1) {
      this.nuevoVeterinario.diasLaborales.splice(index, 1);
    } else {
      this.nuevoVeterinario.diasLaborales.push(dia);
    }
  }
  // Botones para el action sheet de fotos
  actionSheetButtons = [
    {
      text: 'Tomar foto',
      icon: 'camera',
      handler: () => this.tomarFoto(CameraSource.Camera)
    },
    {
      text: 'Elegir de galería',
      icon: 'image',
      handler: () => this.tomarFoto(CameraSource.Photos)
    },
    {
      text: 'Cancelar',
      icon: 'close',
      role: 'cancel'
    }
  ];

  // Métodos para controlar el modal
  abrirModalCreacion() {
    this.resetForm();
    this.isModalOpen = true;
  }

  abrirModalEdicion(veterinario: any) {
    this.editMode = true;
    this.editingId = veterinario.id;
    this.nuevoVeterinario = {
      ...veterinario,
      diasLaborales: this.convertirObjetoDias(veterinario.diasLaborales),
      horariosLaborales: veterinario.horariosLaborales || {}
    };
    this.isModalOpen = true;
  }

  cerrarModal() {
    this.isModalOpen = false;
    this.resetForm();
  }
  // Convertir objeto de días a array para Firestore
  private convertirObjetoDias(dias: any): any {
    // Si ya es el formato de objeto que necesitamos (del formulario)
    if (typeof dias === 'object' && !Array.isArray(dias)) {
      return dias;
    }

    // Si es un array, convertirlo al formato del formulario
    const diasObj: any = {};
    this.diasSemana.forEach(dia => {
      diasObj[dia] = Array.isArray(dias) ? dias.includes(dia) : false;
    });
    return diasObj;
  }

  // Método para seleccionar fuente de foto
  seleccionarFuenteFoto() {
    this.showActionSheet = true;
  }

  async actualizarDisponibilidad(id: string, disponible: boolean) {
    const veterinarioRef = doc(this.firestore, 'veterinarios', id);
    await updateDoc(veterinarioRef, { disponible });
  }
  async tomarFoto(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source
      });

      if (image.base64String) {
        // Guardar la imagen localmente
        const savedFile = await this.guardarImagenLocalmente(image.base64String);
        this.nuevoVeterinario.foto = savedFile.webPath;
      }
    } catch (error) {
      console.error('Error al tomar foto:', error);
      const toast = await this.toastController.create({
        message: 'Error al capturar la imagen',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  private async guardarImagenLocalmente(base64Data: string): Promise<any> {
    const fileName = `vet_${new Date().getTime()}.jpeg`;

    if (Capacitor.isNativePlatform()) {
      // Para dispositivos móviles
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Data
      });

      return {
        filepath: savedFile.uri,
        webPath: Capacitor.convertFileSrc(savedFile.uri)
      };
    } else {
      // Para navegadores web
      return {
        filepath: fileName,
        webPath: `data:image/jpeg;base64,${base64Data}`
      };
    }
  }

  // Método para cargar una imagen guardada
  async cargarImagen(filePath: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const file = await Filesystem.readFile({
        path: filePath,
        directory: Directory.Data
      });
      return `data:image/jpeg;base64,${file.data}`;
    } else {
      return filePath; // Ya es un data URL en web
    }
  }
}
