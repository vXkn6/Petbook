import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs } from '@angular/fire/firestore';
import { AnimationController } from '@ionic/angular';
import { AutheticationService } from 'src/app/services/authetication.service'; // Asegúrate de que la ruta sea correcta

// --- Interfaces ---
interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
  id?: string;
}

interface QuickReply {
  text: string;
  response?: string;
  action?: string;
}

interface Veterinarian {
  id: string;
  nombre: string;
  especialidad: string;
  diasLaborales: string[];
  horariosLaborales: { [dia: string]: string[] };
  disponible: boolean;
}

// --- Componente ChatbotPage ---
@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: false,
})
export class ChatbotPage implements OnInit {
  @ViewChild('chatContainer', { static: false }) chatContainer!: ElementRef;
  @ViewChild('messageInput', { static: false }) messageInput!: ElementRef;

  messages: Message[] = [];
  currentMessage: string = '';
  isTyping: boolean = false;
  
  waitingForVetName: boolean = false;
  allVeterinarians: Veterinarian[] = [];

  quickReplies: QuickReply[] = [
    { text: '¿Cómo puedes ayudarme?', response: 'Soy tu asistente veterinario. Puedo responder preguntas sobre nuestros servicios, horarios, ubicación, vacunas y ayudarte a consultar disponibilidad para citas.' },
    { text: 'Horas disponibles generales de la semana', action: 'showGeneralHours' },
    { text: 'Horas disponibles por veterinario', action: 'askForVetName' },
    { text: '¿Dónde están ubicados?', response: 'Estamos ubicados en el centro de la ciudad. Puedes encontrarnos en la Av. Principal #123.' },
    { text: '¿Cuáles son sus servicios?', response: 'Ofrecemos servicios de consulta veterinaria, vacunación, castración, cirugía y peluquería.' },
    { text: '¿Qué vacunas necesita mi perro?', response: 'Vacunar a tu perro es parte clave de la tenencia responsable: Obligatorias -> Vacuna antirrábica. Vacunas esenciales -> Vacuna séxtuple (protegen contra distemper, parvovirus, hepatitis, parainfluenza y leptospirosis).' },
  ];

  keywordResponses: { [key: string]: string } = {
    'hola': '¡Hola! 👋 Bienvenido/a a nuestra clínica veterinaria. ¿En qué puedo ayudarte hoy?',
    'buenos días': '¡Buenos días! ☀️ ¿Cómo puedo asistirte en temas veterinarios?',
    'buenas tardes': '¡Buenas tardes! 🌅 ¿En qué puedo ayudarte hoy?',
    'buenas noches': '¡Buenas noches! 🌙 ¿Cómo puedo asistirte con tu mascota?',
    'gracias': '¡De nada! 😊 ¿Hay algo más en lo que pueda ayudarte con tu amigo peludo?',
    'adiós': '¡Hasta luego! 👋 Que tengas un excelente día y tu mascota también.',
    'precio': 'Los precios varían según el servicio y el tamaño de la mascota. ¿Podrías ser más específico sobre qué servicio veterinario te interesa?',
    'costo': 'Los costos dependen del tipo de servicio veterinario. Te recomiendo contactar directamente para una cotización personalizada.',
    'horario': 'Nuestros horarios de atención son de Lunes a Viernes de 9:00 AM a 6:00 PM, y Sábados de 9:00 AM a 2:00 PM.',
    'ubicación': 'Estamos ubicados en el centro de la ciudad. Puedes encontrarnos en la Av. Principal #123.',
    'dirección': 'Nuestra dirección es Av. Principal #123, en el centro de la ciudad.',
    'teléfono': 'Puedes contactarnos al teléfono +56 9 1234 5678.',
    'email': 'Nuestro email de contacto es info@clinicaveterinaria.com',
    'correo': 'Puedes escribirnos a info@clinicaveterinaria.com',
    'ayuda': 'Estoy aquí para ayudarte con cualquier consulta relacionada con nuestra clínica y tus mascotas. ¿Qué necesitas saber?',
    'servicio': 'Ofrecemos servicios de consulta general, vacunación, desparasitación, cirugías, emergencias, peluquería y tratamientos especializados.',
    'problema': 'Lamento escuchar que tu mascota tiene un problema. Si necesitas ayuda urgente, por favor, llama a la clínica. ¿Podrías contarme más detalles para poder ayudarte mejor o indicarte si necesitas una cita?',
    'emergencia': 'Si es una emergencia veterinaria, por favor, llama de inmediato al +56 9 1234 5678 o dirígete a nuestra clínica en Av. Principal #123.',
    'vacunas': '¿Te refieres a las vacunas para perros o gatos? Para perros, las obligatorias suelen ser la antirrábica y las esenciales (séxtuple).',
    'desparasitación': 'La desparasitación es crucial para la salud de tu mascota. Ofrecemos desparasitación interna y externa. ¿Te gustaría agendar una cita para ello?',
    'peluquería': 'Tenemos servicio de peluquería canina y felina con baños, cortes y tratamientos de pelo. ¿Para qué tipo de mascota te interesa?',
    'cita': 'Para agendar una cita, puedes hacerlo a través de nuestra sección de "Citas" en la aplicación, o si tienes una emergencia, por favor llámanos directamente.'
  };

  constructor(
    private firestore: Firestore,
    private animationCtrl: AnimationController,
    private authService: AutheticationService 
  ) {}

  async ngOnInit() {
    this.initializeChat();
    await this.loadAllVeterinarians();
  }

  initializeChat() {
    const welcomeMessage: Message = {
      text: '¡Hola! 👋 Soy tu asistente virtual de la clínica veterinaria. Estoy aquí para ayudarte. Puedes usar las preguntas rápidas de abajo o escribir tu consulta.',
      isUser: false,
      timestamp: new Date()
    };
    this.messages.push(welcomeMessage);
    this.scrollToBottom();
  }

  addBotMessage(text: string) {
    const botMessage: Message = {
      text: text,
      isUser: false,
      timestamp: new Date()
    };
    this.messages.push(botMessage);
    this.saveMessageToFirebase(botMessage);
    this.scrollToBottom();
  }

  addUserMessage(text: string) {
    const userMessage: Message = {
      text: text,
      isUser: true,
      timestamp: new Date()
    };
    this.messages.push(userMessage);
    this.saveMessageToFirebase(userMessage);
    this.scrollToBottom();
  }

  async loadAllVeterinarians() {
    try {
      const veterinariansRef = collection(this.firestore, 'veterinarios');
      const q = query(veterinariansRef, where('disponible', '==', true));
      const querySnapshot = await getDocs(q);
      this.allVeterinarians = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veterinarian));
    } catch (error) {
      console.error('Error al cargar veterinarios:', error);
      this.addBotMessage('Lo siento, no pude cargar la lista de veterinarios en este momento. Intenta de nuevo más tarde.');
    }
  }

  sendMessage() {
    if (this.currentMessage.trim() === '') return;

    const userMessageText = this.currentMessage;
    this.addUserMessage(userMessageText);

    this.currentMessage = '';

    this.processUserMessage(userMessageText);
  }

  async processUserMessage(messageText: string) {
    this.showTypingIndicator();

    if (this.waitingForVetName) {
      this.waitingForVetName = false;
      await this.showVeterinarianAvailability(messageText);
      this.hideTypingIndicator();
      return;
    }

    setTimeout(async () => {
      let responseText: string | null = null;

      const lowerMessage = messageText.toLowerCase();

      if (lowerMessage.includes('horas disponibles generales') || lowerMessage.includes('horario semanal')) {
        await this.showGeneralWeeklyAvailability();
      } else if (lowerMessage.includes('horas disponibles por veterinario') || lowerMessage.includes('disponibilidad de veterinario') || lowerMessage.includes('horario de un veterinario')) {
        this.addBotMessage("Claro, ¿para qué veterinario te gustaría saber la disponibilidad? Por favor, escribe su nombre completo o parte de él.");
        this.waitingForVetName = true;
      } else {
        responseText = this.generateResponse(messageText);
        if (responseText) {
          this.addBotMessage(responseText);
        } else {
          this.addBotMessage('Gracias por tu mensaje. No estoy seguro de cómo ayudarte con eso. Si necesitas asistencia específica, por favor, reformula tu pregunta o usa una de las opciones rápidas.');
        }
      }
      
      this.hideTypingIndicator();
    }, 1000);
  }

  generateResponse(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    for (const keyword in this.keywordResponses) {
      if (lowerMessage.includes(keyword)) {
        return this.keywordResponses[keyword];
      }
    }

    if ((lowerMessage.includes('cómo') && lowerMessage.includes('contactar')) || lowerMessage.includes('contactarlos') || lowerMessage.includes('contacto')) {
      return 'Puedes contactarnos por teléfono al +56 9 1234 5678, por email a info@clinicaveterinaria.com, o visitarnos en nuestra oficina en Av. Principal #123.';
    }
    if (lowerMessage.includes('cuánto') && (lowerMessage.includes('cuesta') || lowerMessage.includes('vale') || lowerMessage.includes('precio'))) {
      return 'Los precios varían según el servicio que necesites para tu mascota. Te recomiendo contactarnos directamente para una cotización personalizada. ¿Qué servicio específico te interesa?';
    }
    if (lowerMessage.includes('disponible') || lowerMessage.includes('abierto')) {
      return 'Nuestra clínica está abierta de Lunes a Viernes de 9:00 AM a 6:00 PM, y Sábados de 9:00 AM a 2:00 PM.';
    }
    if (lowerMessage.includes('perro') && (lowerMessage.includes('enfermo') || lowerMessage.includes('mal'))) {
        return 'Lamento escuchar eso. Si tu perro se siente mal, es importante que lo vea un veterinario. ¿Te gustaría agendar una cita o es una emergencia?';
    }
    if (lowerMessage.includes('gato') && (lowerMessage.includes('enfermo') || lowerMessage.includes('mal'))) {
        return 'Si tu gato se siente mal, lo mejor es que lo revise un veterinario. ¿Te gustaría agendar una cita o es una emergencia?';
    }
    if (lowerMessage.includes('urgencia')) {
        return 'Para emergencias, por favor, llama de inmediato al +56 9 1234 5678 o ven directamente a la clínica en Av. Principal #123.';
    }

    return null; 
  }

  async sendQuickReply(quickReply: QuickReply) {
    this.addUserMessage(quickReply.text);

    this.showTypingIndicator();

    setTimeout(async () => {
      if (quickReply.action === 'showGeneralHours') {
        await this.showGeneralWeeklyAvailability();
      } else if (quickReply.action === 'askForVetName') {
        this.addBotMessage("Claro, ¿para qué veterinario te gustaría saber la disponibilidad? Por favor, escribe su nombre completo o parte de él.");
        this.waitingForVetName = true;
      } else if (quickReply.response) {
        this.addBotMessage(quickReply.response);
      }
      
      this.hideTypingIndicator();
    }, 800);
  }

  async showGeneralWeeklyAvailability() {
    this.addBotMessage("Buscando las horas disponibles generales para la próxima semana...");
    let availabilityText = "Aquí están las horas disponibles por día para los **próximos 7 días**:\n\n";

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const formattedDate = date.toISOString().split('T')[0];
      const dayOfWeekNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayOfWeekNames[date.getDay()];

      availabilityText += `**${dayName}, ${formattedDate}:**\n`;

      const veterinariansForThisDay = this.allVeterinarians.filter(vet => 
        vet.diasLaborales && vet.diasLaborales.includes(dayName)
      );

      if (veterinariansForThisDay.length === 0) {
        availabilityText += "  No hay veterinarios disponibles para este día.\n";
      } else {
        let hasAvailableHours = false;
        for (const vet of veterinariansForThisDay) {
          const vetWorkHours = (vet.horariosLaborales && vet.horariosLaborales[dayName]) ? 
                               vet.horariosLaborales[dayName] : [];

          if (vetWorkHours.length > 0) {
            const availableHoursForVet = await this.filterOccupiedHours(
              vetWorkHours, 
              vet.id, 
              formattedDate
            );
            // MODIFICACIÓN AQUÍ: Formatear las horas como lista
            if (availableHoursForVet.length > 0) {
              availabilityText += `  **${vet.nombre}**: \n`;
              availableHoursForVet.forEach(hour => {
                availabilityText += `    • ${hour}\n`; // Cada hora en una nueva línea con viñeta
              });
              hasAvailableHours = true;
            }
          }
        }
        if (!hasAvailableHours) {
            availabilityText += `  Todos los veterinarios están ocupados o no tienen horarios definidos para este día.\n`;
        }
      }
      availabilityText += "\n";
    }
    this.addBotMessage(availabilityText);
  }

  async showVeterinarianAvailability(vetNameInput: string) {
    const lowerVetNameInput = vetNameInput.toLowerCase();
    const foundVet = this.allVeterinarians.find(vet => 
      vet.nombre.toLowerCase().includes(lowerVetNameInput)
    );

    if (!foundVet) {
      this.addBotMessage(`Lo siento, no encontré un veterinario llamado "${vetNameInput}". Por favor, verifica el nombre o intenta con otro.`);
      return;
    }

    this.addBotMessage(`Buscando las horas disponibles para ${foundVet.nombre} para la próxima semana...`);
    let availabilityText = `Horas disponibles para **${foundVet.nombre}** para los **próximos 7 días**:\n\n`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const formattedDate = date.toISOString().split('T')[0];
      const dayOfWeekNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayName = dayOfWeekNames[date.getDay()];

      availabilityText += `**${dayName}, ${formattedDate}:**\n`;

      if (foundVet.diasLaborales && foundVet.diasLaborales.includes(dayName)) {
        const vetWorkHours = (foundVet.horariosLaborales && foundVet.horariosLaborales[dayName]) ? 
                             foundVet.horariosLaborales[dayName] : [];

        if (vetWorkHours.length > 0) {
          const availableHours = await this.filterOccupiedHours(
            vetWorkHours, 
            foundVet.id, 
            formattedDate
          );
          // MODIFICACIÓN AQUÍ: Formatear las horas como lista
          if (availableHours.length > 0) {
            availableHours.forEach(hour => {
              availabilityText += `  • ${hour}\n`; // Cada hora en una nueva línea con viñeta
            });
          } else {
            availabilityText += `  Todas las horas están ocupadas para este día.\n`;
          }
        } else {
          availabilityText += `  No tiene horarios definidos para este día.\n`;
        }
      } else {
        availabilityText += `  No trabaja este día.\n`;
      }
      availabilityText += "\n";
    }
    this.addBotMessage(availabilityText);
  }

  async filterOccupiedHours(hours: string[], veterinarianId: string, date: string): Promise<string[]> {
    try {
      const appointmentsRef = collection(this.firestore, 'citas');
      const q = query(
        appointmentsRef,
        where('veterinarioId', '==', veterinarianId),
        where('fecha', '==', date)
      );
      
      const snapshot = await getDocs(q);
      const occupiedHours = snapshot.docs.map(doc => doc.data()['hora']);
      
      const now = new Date();
      const currentFormattedDate = now.toISOString().split('T')[0];
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();

      return hours.filter(hour => {
        if (occupiedHours.includes(hour)) {
          return false;
        }

        if (date === currentFormattedDate) {
            const [h, m] = hour.split(':').map(Number);
            if (h < currentHour || (h === currentHour && m <= currentMinutes)) {
                return false;
            }
        }
        return true;
      });
    } catch (error) {
      console.error('Error al filtrar horarios en chatbot:', error);
      return hours;
    }
  }

  showTypingIndicator() {
    this.isTyping = true;
  }

  hideTypingIndicator() {
    this.isTyping = false;
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  saveMessageToFirebase(message: Message) {
    const messagesCollection = collection(this.firestore, 'chat-messages');
    addDoc(messagesCollection, {
      ...message,
      timestamp: new Date()
    }).catch(error => {
      console.error('Error guardando mensaje:', error);
    });
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.sendMessage();
    }
  }

  clearChat() {
    this.messages = [];
    this.initializeChat();
    this.waitingForVetName = false;
  }
}