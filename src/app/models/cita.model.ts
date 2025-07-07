// cita.model.ts

export interface Cita {
  id?: string;
  veterinarioId: string;
  veterinarioNombre: string;
  fecha: string; // Formato 'YYYY-MM-DD'
  hora: string;
  motivo: string;
  petId: string;
  petName?: string;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'completada'; // Actualizado para incluir 'cancelada'
  userId: string;
  fechaCreacion: Date;
  recetaBase64?: string;
  vetName?: string;
  motivoCancelacion?: string; // ¡Nuevo! Campo para el motivo de la cancelación
}

// Tipo para el estado de la cita
export type EstadoCita = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';

// Función para inicializar una nueva cita
export function nuevaCita(userId: string = '', petId: string= ''): Cita {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Los meses son 0-indexados, por eso se le suma 1
  const day = today.getDate().toString().padStart(2, '0');

  return {
    veterinarioId: '',
    veterinarioNombre: '',
    fecha: `${year}-${month}-${day}`, // Formato 'YYYY-MM-DD'
    hora: '',
    motivo: '',
    estado: 'pendiente', // Por defecto, una cita nueva siempre estará 'pendiente'
    userId: userId,
    petId: petId,
    fechaCreacion: new Date()
  };
}