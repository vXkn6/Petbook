import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { IonicModule, AlertController, ActionSheetController, ModalController, ToastController, LoadingController } from '@ionic/angular';
import { Firestore, collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, FirestoreModule, } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { authState } from 'rxfire/auth';
import { Storage, ref, deleteObject, StorageModule, } from '@angular/fire/storage';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Subscription } from 'rxjs';
import { Filesystem, Directory, } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import { add, camera, close, create, paw, trash, } from 'ionicons/icons';
import { Pet, Species, Breed } from '../../models/pet.model';
import Compressor from 'compressorjs';


@Component({
  selector: 'app-petfile',
  templateUrl: './petfile.page.html',
  styleUrls: ['./petfile.page.scss'],
  standalone: false,
})

export class PetfilePage implements OnInit, OnDestroy {

  pets: Pet[] = [];
  userUid: string | null = null;
  petForm: FormGroup;
  isEditing = false;
  currentPetId: string | null = null;
  selectedPhoto: string | null = null;
  showPetDetail: boolean = false;
  selectedPet: Pet | null = null;
  species: Species[] = [];
  breeds: Breed[] = [];
  filteredBreeds: Breed[] = [];
  showSpeciesBreedModal = false;
  isAddingSpecies = true;
  speciesBreedForm: FormGroup;

  private authSub: Subscription | undefined;

  constructor(

    private firestore: Firestore,
    private auth: Auth,
    private storage: Storage,
    private formBuilder: FormBuilder,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController

  ) {

    this.petForm = this.formBuilder.group({
      name: ['', Validators.required],
      nickname: [''],
      age: [0, [Validators.required, Validators.min(0), Validators.max(30)]],
      species: ['', Validators.required],
      breed: ['',],
      weight: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      chipId: ['', [Validators.required]]

    });
    this.speciesBreedForm = this.formBuilder.group({
      name: ['', Validators.required],
      speciesId: ['']
    });

    addIcons({ paw, add, close, create, trash, camera });

  }

  ngOnInit() {

    this.authSub = authState(this.auth).subscribe(user => {
      if (user) {
        this.userUid = user.uid;
        this.loadSpecies();
        this.loadBreeds();
        this.loadPets();
      } else {
        this.userUid = null;
        this.pets = [];
        this.species = [];
        this.breeds = [];
      }

    });

  }

  ngOnDestroy() {

    this.authSub?.unsubscribe();

  }

  async loadPets() {

    if (!this.userUid) return;
    try {
      const q = query(
        collection(this.firestore, 'pets'),
        where('userId', '==', this.userUid)
      );
      const querySnapshot = await getDocs(q);
      this.pets = [];
      querySnapshot.forEach((doc) => {
        this.pets.push({
          id: doc.id,
          ...doc.data() as Pet
        });
      });
    } catch (error) {
      console.error('Error loading pets:', error);
    }

  }

  async loadSpecies() {

    try {
      const q = query(collection(this.firestore, 'species'));
      const querySnapshot = await getDocs(q);
      this.species = [];
      querySnapshot.forEach((doc) => {
        this.species.push({
          id: doc.id,
          ...doc.data() as Species
        });
      });
    } catch (error) {
      console.error('Error loading species:', error);
    }

  }

  async loadBreeds() {

    try {
      const q = query(collection(this.firestore, 'breeds'));
      const querySnapshot = await getDocs(q);
      this.breeds = [];
      querySnapshot.forEach((doc) => {
        this.breeds.push({
          id: doc.id,
          ...doc.data() as Breed
        });
      });
    } catch (error) {
      console.error('Error loading breeds:', error);
    }

  }

  async loadSpeciesAndBreeds() {

    try {
      const [speciesSnapshot, breedsSnapshot] = await Promise.all([
        getDocs(collection(this.firestore, 'species')),
        getDocs(collection(this.firestore, 'breeds'))
      ]);

      this.species = speciesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as any
      }));

      this.breeds = breedsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as any
      }));

      console.log('Datos actualizados:', {
        species: this.species,
        breeds: this.breeds
      });

    } catch (error) {
      console.error('Error loading data:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error al cargar especies y razas',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }

  }

  async openPetForm(pet: Pet | null = null) {

    await this.loadSpeciesAndBreeds();

    this.showPetDetail = false;

    if (pet) {
      this.isEditing = true;
      this.currentPetId = pet.id || null;
      this.petForm.setValue({
        name: pet.name,
        nickname: pet.nickname,
        age: pet.age,
        breed: pet.breed,
        weight: pet.weight,
        chipId: pet.chipId,
        species: pet.species,
      });

      this.filterBreedsBySpecies(pet.species);

      if (pet.photoUrl) {
        try {
          this.selectedPhoto = await this.loadLocalImage(pet.photoUrl);
        } catch (error) {
          console.error('Error loading pet image:', error);
          this.selectedPhoto = 'https://ionicframework.com/docs/img/demos/thumbnail.svg';
        }
      } else {
        this.selectedPhoto = 'https://ionicframework.com/docs/img/demos/thumbnail.svg';
      }
    } else {
      this.isEditing = false;
      this.currentPetId = null;
      this.petForm.reset({
        name: '',
        nickname: '',
        age: 0,
        species: '',
        breed: '',
        weight: 0,
        chipId: ''
      });

      this.filteredBreeds = [];
      this.selectedPhoto = null;

    }

    this.petForm.markAsDirty();

  }

  async submitForm() {
    if (!this.userUid || this.petForm.invalid) return;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando mascota...'
    });
    await loading.present();

    try {
      // Verificar si la imagen es demasiado grande (Firestore limita a 1MB)
      let photoUrl = this.selectedPhoto || '';
      if (photoUrl && photoUrl.length > 900 * 1024) {
        // Comprimir más si es necesario
        photoUrl = await this.compressImage(photoUrl);
      }

      const petData: Record<string, any> = {
        ...this.petForm.value,
        userId: this.userUid,
        photoUrl, // Usamos la URL comprimida
        speciesName: this.species.find(s => s.id === this.petForm.value.species)?.name || '',
        breedName: this.breeds.find(b => b.id === this.petForm.value.breed)?.name || ''
      };

      if (this.isEditing && this.currentPetId) {
        await updateDoc(doc(this.firestore, 'pets', this.currentPetId), petData);
      } else {
        await addDoc(collection(this.firestore, 'pets'), petData);
      }

      const toast = await this.toastCtrl.create({
        message: 'Mascota guardada correctamente',
        duration: 2000,
        color: 'success'
      });
      await toast.present();

      this.petForm.reset();
      this.selectedPhoto = null;
      this.isEditing = false;
      this.currentPetId = null;
      await this.loadPets();
    } catch (error) {
      console.error('Error saving pet:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error al guardar la mascota',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

  async deletePet(pet: Pet) {

    const alert = await this.alertCtrl.create({

      header: 'Confirmar eliminación',
      message: `¿Estás seguro de que deseas eliminar a ${pet.name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: async () => {
            if (pet.id) {
              try {
                if (pet.photoUrl && pet.photoUrl.includes('firebase')) {
                  try {
                    const imageRef = ref(this.storage, pet.photoUrl);
                    await deleteObject(imageRef);
                  } catch (error) {
                    console.error('Error deleting image:', error);
                  }
                }

                await deleteDoc(doc(this.firestore, 'pets', pet.id));
                this.loadPets();
                this.closePetDetail();
              } catch (error) {
                console.error('Error deleting pet:', error);
              }
            }
          }
        }
      ]
    });

    await alert.present();

  }

  viewPetDetail(pet: Pet) {

    this.selectedPet = pet;
    this.showPetDetail = true;

  }

  getSpeciesName(speciesId: string): string {

    const species = this.species.find(s => s.id === speciesId);
    return species ? species.name : 'Unknown';

  }

  getBreedName(BreedId: string): string {

    const breed = this.breeds.find(s => s.id === BreedId);
    return breed ? breed.name : 'Unknown';

  }

  closePetDetail() {

    this.showPetDetail = false;
    this.selectedPet = null;

  }

  filterBreedsBySpecies(speciesId: string) {
    this.filteredBreeds = this.breeds.filter(breed => breed.speciesId === speciesId);
  }

  async takePicture() {

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Seleccionar imagen',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.getPicture(CameraSource.Camera);
          }
        },
        {
          text: 'Elegir de la galería',
          icon: 'image',
          handler: () => {
            this.getPicture(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();

  }

  async getPicture(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source
      });

      if (image.dataUrl) {
        // Comprimir la imagen antes de asignarla
        const compressedDataUrl = await this.compressImage(image.dataUrl);
        this.selectedPhoto = compressedDataUrl;
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error al procesar la imagen',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    }
  }

  private async compressImage(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Convertir Data URL a Blob
      const blob = this.dataUrlToBlob(dataUrl);

      new Compressor(blob, {
        quality: 0.7,
        maxWidth: 800,
        maxHeight: 800,
        success(result) {
          // Convertir el Blob comprimido de vuelta a Data URL
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(result);
        },
        error: reject
      });
    });
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
  }

  private async loadLocalImage(path: string): Promise<string> {

    if (!path) return 'https://ionicframework.com/docs/img/demos/thumbnail.svg';

    if (path.startsWith('data:image')) {
      return path; // Ya es un data URL (para web)
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const file = await Filesystem.readFile({
          path: path,
          directory: Directory.Data
        });
        return `data:image/jpeg;base64,${file.data}`;
      } catch (error) {
        console.error('Error reading local image:', error);
        return 'https://ionicframework.com/docs/img/demos/thumbnail.svg';
      }
    } else {
      return path; // En web, debería ser un data URL
    }

  }

  async openSpeciesBreedModal(isSpecies: boolean) {
    this.isAddingSpecies = isSpecies;
    this.speciesBreedForm.reset();

    if (!isSpecies) {
      // Si estamos añadiendo una raza, necesitamos cargar las especies primero
      await this.loadSpecies();
      this.speciesBreedForm.get('speciesId')?.setValidators(Validators.required);
    } else {
      this.speciesBreedForm.get('speciesId')?.clearValidators();
    }
    this.speciesBreedForm.get('speciesId')?.updateValueAndValidity();

    this.showSpeciesBreedModal = true;
  }

  closeSpeciesBreedModal() {
    this.showSpeciesBreedModal = false;
    this.speciesBreedForm.reset();
  }

  async saveSpeciesOrBreed() {
    if (this.speciesBreedForm.invalid) return;

    const loading = await this.loadingCtrl.create({
      message: 'Guardando...'
    });
    await loading.present();

    try {
      if (this.isAddingSpecies) {
        // Guardar nueva especie
        await addDoc(collection(this.firestore, 'species'), {
          name: this.speciesBreedForm.value.name
        });
        const toast = await this.toastCtrl.create({
          message: 'Especie añadida correctamente',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
      } else {
        // Guardar nueva raza
        await addDoc(collection(this.firestore, 'breeds'), {
          name: this.speciesBreedForm.value.name,
          speciesId: this.speciesBreedForm.value.speciesId
        });
        const toast = await this.toastCtrl.create({
          message: 'Raza añadida correctamente',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
      }

      // Recargar datos
      await this.loadSpecies();
      await this.loadBreeds();
      this.closeSpeciesBreedModal();
    } catch (error) {
      console.error('Error saving:', error);
      const toast = await this.toastCtrl.create({
        message: 'Error al guardar',
        duration: 2000,
        color: 'danger'
      });
      await toast.present();
    } finally {
      await loading.dismiss();
    }
  }

}
