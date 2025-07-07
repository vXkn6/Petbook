export interface Cita {
  id?: string;
  veterinarioId: string;
  veterinarioNombre: string;
  fecha: Date;
  hora: string;
  motivo: string;
  petId: string; // Opcional
  petName?: string; // Opcional
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
  userId: string;
  fechaCreacion: Date;
  recetaBase64?: string; // Cambiamos a base64 string
  vetName?: string;
  motivoCancelacion?: string;
}

// Tipo para el estado de la cita
export type EstadoCita = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';

// Creamos una función para inicializar una nueva cita
export function nuevaCita(userId: string = '', petId: string= ''): Cita {
  return {
    veterinarioId: '',
    veterinarioNombre: '',
    fecha: new Date(),
    hora: '',
    motivo: '',
    estado: 'pendiente',
    userId: userId,
    petId: petId,
    fechaCreacion: new Date()
  };
}