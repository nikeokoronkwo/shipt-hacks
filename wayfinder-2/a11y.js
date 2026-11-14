/* Wayfinder language + read-aloud controls.
   Loaded by every page in this folder. Adds a floating control that
   switches the page between English and Spanish and reads it aloud in the
   selected language using the browser's built-in speech synthesis.

   To translate new copy, add an entry to ES below: the key is the English
   text exactly as it appears on the page, the value is the Spanish text.
   Anything without an entry (names, addresses, numbers) is left as is. */
(function () {
  'use strict';

  var ES = {
    // Page titles
    'Home': 'Inicio',
    'Become A Driver': 'Sé conductor',
    'Driver Profile': 'Perfil del conductor',
    'Emergency Contacts': 'Contactos de emergencia',
    'Find Shelter': 'Buscar refugio',
    'Shelter Details': 'Detalles del refugio',
    'Shelter Registration': 'Registro de refugio',
    'Submit Feedback': 'Enviar comentarios',
    'Track Ride': 'Seguir viaje',

    // Navigation and footer
    'Shelters': 'Refugios',
    'Drivers': 'Conductores',
    'Dispatch': 'Despacho',
    'About': 'Acerca de',
    'Sign in': 'Iniciar sesión',
    'Log In': 'Iniciar sesión',
    'Find Bed': 'Buscar cama',
    'Get Help Now': 'Obtener ayuda ahora',
    'Live Bed Sync': 'Camas en tiempo real',
    'For Shelters': 'Para refugios',
    'Volunteer Drivers': 'Conductores voluntarios',
    'Partners': 'Aliados',
    'Network': 'Red',
    'Portland Shelters': 'Refugios de Portland',
    'Bed Status': 'Estado de camas',
    'Metro Map': 'Mapa metropolitano',
    'Volunteer': 'Voluntariado',
    'Driver Signup': 'Registro de conductores',
    'Safety Guidelines': 'Normas de seguridad',
    'Dispatch Log': 'Registro de despacho',
    'Contact': 'Contacto',
    'Admin Office': 'Oficina administrativa',
    '© 2026 Wayfinder Civic Tech. Operating in partnership with Metro Area Community Services.':
      '© 2026 Wayfinder Civic Tech. Operamos en colaboración con Metro Area Community Services.',

    // Home
    '12 beds • 0.8 mi': '12 camas • 0.8 mi',
    '5 beds · 1.4 mi': '5 camas · 1.4 mi',
    '2 beds · 2.1 mi': '2 camas · 2.1 mi',
    'Safe shelter and a ride there, right now.': 'Un refugio seguro y transporte para llegar, ahora mismo.',
    'Enter Portland address or neighborhood...': 'Ingresa una dirección o vecindario de Portland...',
    'Use My Current Location': 'Usar mi ubicación actual',
    'Open Now': 'Abierto ahora',
    'Families': 'Familias',
    'Pet-Friendly': 'Acepta mascotas',
    'Women Only': 'Solo mujeres',
    'Wheelchair Accessible': 'Accesible en silla de ruedas',
    'Need a Ride': 'Necesito transporte',
    'Search Shelters': 'Buscar refugios',
    'Available Beds': 'Camas disponibles',
    'Active Drivers': 'Conductores activos',
    'Dispatch Calls': 'Llamadas de despacho',
    'Shelter Partners': 'Refugios aliados',
    'Shelter Bed-Management Dashboard': 'Panel de gestión de camas del refugio',
    'Central Shelter Alpha · Live Broadcast': 'Central Shelter Alpha · Transmisión en vivo',
    'Active Sync': 'Sincronización activa',
    'Emergency Bed Capacity (Total 42)': 'Capacidad de camas de emergencia (42 en total)',
    '8 beds currently available': '8 camas disponibles en este momento',
    'Incoming Ride Alerts & Auto-Dispatch': 'Alertas de viajes entrantes y despacho automático',
    'Notify staff 10 min prior to arrival': 'Avisar al personal 10 min antes de la llegada',
    'Waitlist Queue Priority': 'Prioridad en la lista de espera',
    'Auto-match nearest verified riders': 'Asignar automáticamente a los pasajeros verificados más cercanos',
    'FOR SHELTERS & ORGS': 'PARA REFUGIOS Y ORGANIZACIONES',
    'Fill open beds without phone-tag bottlenecks': 'Ocupa las camas libres sin depender de llamadas interminables',
    'Broadcasting real-time shelter capacity eliminates frantic late-night calls. Wayfinder coordinates drop-offs seamlessly with volunteer drivers so intake teams can focus entirely on guest care.':
      'Publicar la capacidad del refugio en tiempo real elimina las llamadas urgentes a medianoche. Wayfinder coordina las llegadas con conductores voluntarios para que el equipo de admisión pueda dedicarse por completo a atender a los huéspedes.',
    'Register Your Shelter': 'Registra tu refugio',
    'Shelter Portal Login': 'Acceso al portal de refugios',
    'FOR VOLUNTEER RIDERS': 'PARA CONDUCTORES VOLUNTARIOS',
    'Turn an empty seat into a safe arrival': 'Convierte un asiento vacío en una llegada segura',
    'Verified community drivers bridge the transit gap between downtown streets and suburban shelters. Clear directions, secure communication, and zero guesswork for every trip.':
      'Conductores comunitarios verificados cubren la falta de transporte entre las calles del centro y los refugios de las afueras. Indicaciones claras, comunicación segura y cero incertidumbre en cada viaje.',
    'Sign Up to Drive': 'Regístrate para conducir',
    'Driver Portal Login': 'Acceso al portal de conductores',
    'Active Trip Dispatch': 'Despacho de viaje activo',
    'PICKUP LOCATION': 'PUNTO DE RECOGIDA',
    'SW 4th & Morrison St (Transit Stop 4B)': 'SW 4th & Morrison St (parada de tránsito 4B)',
    'DESTINATION SHELTER': 'REFUGIO DE DESTINO',
    'Hope Bridge Center (Bed #14)': 'Hope Bridge Center (cama n.º 14)',
    'Verified Rider Badge #8492': 'Credencial de pasajero verificado n.º 8492',
    'Secure': 'Seguro',
    'Trusted by local transit, hospitality, and community partners':
      'Con la confianza de aliados locales de transporte, hotelería y la comunidad',
    'Corporate Sponsorships': 'Patrocinios corporativos',
    'Employee Volunteer Driver Programs': 'Programas de conductores voluntarios para empleados',
    'Empower your workforce with organized volunteer shifts, corporate ride-matching dashboards, and community impact reporting.':
      'Impulsa a tu equipo con turnos de voluntariado organizados, paneles corporativos de asignación de viajes e informes de impacto comunitario.',
    'Become a Corporate Partner': 'Conviértete en aliado corporativo',
    'Direct Community Funding': 'Financiamiento comunitario directo',
    'Fund Rides & Emergency Bed Nights': 'Financia viajes y noches de cama de emergencia',
    '100% of community donations directly sponsor fuel, transit stipends, and emergency shelter bed reservations for individuals in need.':
      'El 100% de las donaciones de la comunidad se destina directamente a combustible, apoyos de transporte y reservas de camas en refugios de emergencia para personas que lo necesitan.',
    'Donate to Fund Rides': 'Dona para financiar viajes',
    'How Wayfinder coordinates care': 'Cómo Wayfinder coordina la atención',
    'Built for shelter staff, outreach workers, and volunteer drivers across the Portland Metro area.':
      'Creado para el personal de refugios, trabajadores de alcance comunitario y conductores voluntarios de toda el área metropolitana de Portland.',
    'Real-Time Bed Tracking': 'Seguimiento de camas en tiempo real',
    'View hourly updated bed counts across participating local emergency shelters to eliminate wasted trips.':
      'Consulta el número de camas, actualizado cada hora, en los refugios de emergencia locales participantes y evita viajes en vano.',
    'Volunteer Transport': 'Transporte voluntario',
    'Coordinate secure rides with verified community drivers operated in partnership with Metro Area Community Services.':
      'Coordina viajes seguros con conductores comunitarios verificados, en colaboración con Metro Area Community Services.',
    'Central Dispatch': 'Despacho central',
    'Connect directly with our 24-hour dispatch hotline for immediate placement assistance and route updates.':
      'Comunícate directamente con nuestra línea de despacho las 24 horas para recibir ayuda inmediata de ubicación y novedades de la ruta.',
    'Transport Coordination': 'Coordinación de transporte',
    'Connecting unhoused individuals with safe transit': 'Conectamos a personas sin hogar con transporte seguro',
    'Our driver dispatch network pairs willing community volunteers with verified shelter openings. Every route is coordinated to ensure safe, direct transit across the Portland Metro area.':
      'Nuestra red de despacho conecta a voluntarios de la comunidad con lugares verificados en refugios. Cada ruta se coordina para garantizar un traslado seguro y directo por el área metropolitana de Portland.',
    'Verified shelter bed matching': 'Asignación de camas verificadas en refugios',
    'Real-time driver GPS tracking': 'Seguimiento GPS del conductor en tiempo real',
    'Direct Metro Area Community Services dispatch': 'Despacho directo de Metro Area Community Services',
    'View Driver Routes': 'Ver rutas de conductores',
    'Wayfinder provides a centralized digital infrastructure for the Portland Metro emergency shelter network. By linking real-time bed availability with volunteer driver coordination, we bridge the gap between people experiencing homelessness and open, verified shelter spaces. Our main administrative office is located at 415 NW 10th Ave, Portland, OR 97209.':
      'Wayfinder ofrece una infraestructura digital centralizada para la red de refugios de emergencia del área metropolitana de Portland. Al unir la disponibilidad de camas en tiempo real con la coordinación de conductores voluntarios, acercamos a las personas sin hogar a espacios de refugio abiertos y verificados. Nuestra oficina administrativa principal está en 415 NW 10th Ave, Portland, OR 97209.',
    'Frequently asked questions': 'Preguntas frecuentes',
    'How often is bed availability updated?': '¿Con qué frecuencia se actualiza la disponibilidad de camas?',
    'Bed availability is updated hourly across all participating local shelters in the Portland Metro network.':
      'La disponibilidad de camas se actualiza cada hora en todos los refugios locales participantes de la red metropolitana de Portland.',
    'Who operates the volunteer driver dispatch?': '¿Quién opera el despacho de conductores voluntarios?',
    'How can I reach the central dispatch hotline?': '¿Cómo me comunico con la línea de despacho central?',
    'Where is the main administrative office located?': '¿Dónde está la oficina administrativa principal?',
    'Get connected to shelter and transport today': 'Conéctate hoy con refugio y transporte',
    'Call our 24-hour central dispatch at 503-555-0199 or search available beds online now.':
      'Llama a nuestro despacho central, disponible las 24 horas, al 503-555-0199 o busca camas disponibles en línea ahora.',
    'Find Open Bed': 'Buscar cama disponible',
    'Volunteer as Driver': 'Ser conductor voluntario',

    // Become a driver
    'Credentials': 'Credenciales',
    'Vehicle': 'Vehículo',
    'Verification': 'Verificación',
    'Sign up, verify credentials, and set availability to provide rides for unhoused neighbors to local shelters.':
      'Regístrate, verifica tus credenciales e indica tu disponibilidad para llevar a vecinos sin hogar a los refugios locales.',
    'Driver Application & Background Check Authorization':
      'Solicitud de conductor y autorización de verificación de antecedentes',
    'Full Legal Name': 'Nombre legal completo',
    'We only use this to contact you about this booking.': 'Solo lo usamos para contactarte sobre esta reserva.',
    'Driver License Number': 'Número de licencia de conducir',
    'Must be a valid Oregon Class C driver license': 'Debe ser una licencia de conducir Clase C de Oregón vigente',
    'Vehicle Make, Model & Year': 'Marca, modelo y año del vehículo',
    'Assigned Operating Zone': 'Zona de operación asignada',
    'In partnership with Metro Area Community Services': 'En colaboración con Metro Area Community Services',
    'Emergency Contact Phone': 'Teléfono de contacto de emergencia',
    'Background Check Consent': 'Consentimiento para verificación de antecedentes',
    'Required for volunteer transport under Portland Metro emergency shelter network':
      'Obligatorio para el transporte voluntario dentro de la red de refugios de emergencia del área metropolitana de Portland',
    'Drop files here': 'Suelta los archivos aquí',
    'or browse — PNG, JPG up to 10MB': 'o examina — PNG, JPG de hasta 10 MB',
    'Submit Application': 'Enviar solicitud',

    // Driver profile
    'Active Duty Shift': 'Turno en servicio',
    'Saturday Evening Transport': 'Transporte del sábado por la noche',
    'Dispatch Hub: 415 NW 10th Ave, Portland, OR 97209': 'Centro de despacho: 415 NW 10th Ave, Portland, OR 97209',
    'On Call · Central Dispatch 503-555-0199': 'De guardia · Despacho central 503-555-0199',
    'Assigned Beds': 'Camas asignadas',
    'Max Radius': 'Radio máximo',
    'View Route': 'Ver ruta',
    'Volunteer Driver · Metro Area Community Services': 'Conductor voluntario · Metro Area Community Services',
    'Missions': 'Misiones',
    'Rating': 'Calificación',
    '3 yrs': '3 años',
    'Tenure': 'Antigüedad',
    'Update Profile': 'Actualizar perfil',
    'Completed Trips': 'Viajes completados',
    'Total Mileage': 'Millas recorridas',
    'Shelter Drops': 'Entregas en refugios',
    'Hours Logged': 'Horas registradas',
    'Assigned Shelters': 'Refugios asignados',
    'Open': 'Abierto',
    'Active': 'Activo',
    '12 beds available · 0.4 mi away · Verified': '12 camas disponibles · a 0.4 mi · Verificado',
    '8 beds available · 0.7 mi away · Verified': '8 camas disponibles · a 0.7 mi · Verificado',
    '15 beds available · 0.2 mi away · Verified': '15 camas disponibles · a 0.2 mi · Verificado',
    'Recent Missions': 'Misiones recientes',
    'Mission #4812': 'Misión n.º 4812',
    'Mission #4809': 'Misión n.º 4809',
    'Mission #4801': 'Misión n.º 4801',
    'Completed': 'Completada',
    'Verified': 'Verificado',
    'Transported 2 individuals from Old Town to Bud Clark Commons':
      'Trasladó a 2 personas de Old Town a Bud Clark Commons',
    'Transported 1 individual from Union Station to The Burnside Shelter':
      'Trasladó a 1 persona de Union Station a The Burnside Shelter',
    'Transported 3 individuals from Chinatown to River District Center':
      'Trasladó a 3 personas de Chinatown a River District Center',
    'Nov 13, 2026 · 4.2 mi · 35 min': '13 nov 2026 · 4.2 mi · 35 min',
    'Nov 12, 2026 · 1.8 mi · 20 min': '12 nov 2026 · 1.8 mi · 20 min',
    'Nov 10, 2026 · 2.5 mi · 28 min': '10 nov 2026 · 2.5 mi · 28 min',
    '2h ago': 'hace 2 h',
    '4h ago': 'hace 4 h',
    '1d ago': 'hace 1 día',
    '2d ago': 'hace 2 días',
    'completed transport for': 'completó el traslado de',
    '2 guests to Bud Clark Commons': '2 huéspedes a Bud Clark Commons',
    'assigned route to': 'asignó una ruta a',
    'verified vehicle safety check for': 'verificó la revisión de seguridad del vehículo',
    'completed shift at': 'completó su turno en',
    'Vehicle & Credential Details': 'Datos del vehículo y credenciales',
    'Vehicle Make & Model': 'Marca y modelo del vehículo',
    'License Plate': 'Placa',
    'Insurance Expiry': 'Vencimiento del seguro',

    // Emergency contacts
    'Administrative Office Contacts': 'Contactos de la oficina administrativa',
    'Main Office Location': 'Ubicación de la oficina principal',
    'Dispatch Hotline': 'Línea de despacho',
    'Operating Hours': 'Horario de atención',
    '24 Hours Daily': 'Las 24 horas, todos los días',
    'Crisis Assistance Protocol': 'Protocolo de asistencia en crisis',
    'When immediate safety is at stake, reach out directly to our 24-hour dispatch hotline or local emergency services. Wayfinder coordinates real-time bed availability across the Portland Metro emergency shelter network to ensure rapid, trusted connection to care.':
      'Cuando la seguridad inmediata esté en riesgo, comunícate directamente con nuestra línea de despacho las 24 horas o con los servicios de emergencia locales. Wayfinder coordina la disponibilidad de camas en tiempo real en toda la red de refugios de emergencia del área metropolitana de Portland para garantizar una conexión rápida y confiable con la atención.',

    // Find shelter
    'Search shelters by neighborhood, zip, or name': 'Busca refugios por vecindario, código postal o nombre',
    'Filters': 'Filtros',
    'All Beds': 'Todas las camas',
    'Pet Friendly': 'Acepta mascotas',
    'ADA Accessible': 'Accesible (ADA)',
    'Family Units': 'Unidades familiares',
    'Sort': 'Ordenar',
    'Verified Emergency Shelters': 'Refugios de emergencia verificados',
    'View Map': 'Ver mapa',
    '12 beds available · Men and Women': '12 camas disponibles · Hombres y mujeres',
    '8 beds available · Men Only': '8 camas disponibles · Solo hombres',
    '5 beds available · Women Only': '5 camas disponibles · Solo mujeres',
    '15 pods available · All Genders': '15 cabinas disponibles · Todos los géneros',
    '0 beds available · Waitlist Open': '0 camas disponibles · Lista de espera abierta',
    'beds': 'camas',
    'pods': 'cabinas',
    'Full': 'Lleno',
    'Real-time bed availability updated hourly across participating local shelters':
      'Disponibilidad de camas en tiempo real, actualizada cada hora en los refugios locales participantes',

    // Shelter details
    'Live Availability Update': 'Disponibilidad en vivo',
    '14 Verified Beds Open Now': '14 camas verificadas disponibles ahora',
    'Updated 12 minutes ago across participating local shelters':
      'Actualizado hace 12 minutos en los refugios locales participantes',
    'Hourly capacity verified by Wayfinder dispatch': 'Capacidad verificada cada hora por el despacho de Wayfinder',
    '9 beds': '9 camas',
    '5 beds': '5 camas',
    "Men's Dorms": 'Dormitorios de hombres',
    "Women's Dorms": 'Dormitorios de mujeres',
    'Request Bed Hold': 'Solicitar reserva de cama',
    'Emergency Men and Women Shelter · Pearl District': 'Refugio de emergencia para hombres y mujeres · Pearl District',
    'Beds': 'Camas',
    'Distance': 'Distancia',
    'Call Intake Desk': 'Llamar a admisión',
    'Share Listing': 'Compartir',
    'Bud Clark Commons Intake': 'Admisión de Bud Clark Commons',
    'Metro Area Community Services Hub': 'Centro de Metro Area Community Services',
    'Central Dispatch Hotline 503-555-0199': 'Línea de despacho central 503-555-0199',
    'Central Dispatch Hotline': 'Línea de despacho central',
    'Intake Requirements & Accessibility': 'Requisitos de admisión y accesibilidad',
    'Intake Hours': 'Horario de admisión',
    '2:00 PM - 8:00 PM daily': '2:00 p. m. - 8:00 p. m. todos los días',
    'Pet Policy': 'Política de mascotas',
    'Service animals only': 'Solo animales de servicio',
    'Accessibility': 'Accesibilidad',
    'ADA compliant ramps and elevators': 'Rampas y ascensores que cumplen con la ADA',
    'Call Dispatch Hotline': 'Llamar a la línea de despacho',
    'Claim Bed Hold': 'Confirmar reserva de cama',

    // Shelter registration
    'Facility': 'Instalación',
    'Capacity': 'Capacidad',
    'Review': 'Revisión',
    'Allows shelter operators to onboard their facility and manage real-time bed availability.':
      'Permite a los operadores de refugios registrar su instalación y gestionar la disponibilidad de camas en tiempo real.',
    'Facility Profile And Capacity': 'Perfil y capacidad de la instalación',
    'Facility Legal Name': 'Nombre legal de la instalación',
    'Enter the official operating name registered with Multnomah County':
      'Ingresa el nombre oficial registrado ante el condado de Multnomah',
    'Primary Contact Name': 'Nombre del contacto principal',
    'Designated shelter operations manager': 'Gerente de operaciones designado del refugio',
    'Total Verified Bed Capacity': 'Capacidad total de camas verificadas',
    'Total funded beds available in current roster': 'Total de camas financiadas disponibles en el registro actual',
    'Intake Operating Hours': 'Horario de admisión',
    'Daily check-in window': 'Horario diario de ingreso',
    'Accessibility Features': 'Características de accesibilidad',
    'Select supported accommodations': 'Selecciona las adaptaciones disponibles',
    'Check all permanent ADA adaptations currently operational':
      'Marca todas las adaptaciones permanentes de la ADA que estén en funcionamiento',
    'Intake Notes And Restrictions': 'Notas y restricciones de admisión',
    'Accepts single adult men and pet dogs on leash. No active alcohol use permitted on premises.':
      'Acepta hombres adultos solos y perros con correa. No se permite el consumo de alcohol en las instalaciones.',
    'Provide specific eligibility criteria for Wayfinder dispatchers':
      'Indica los criterios de elegibilidad específicos para los despachadores de Wayfinder',
    'Save Draft': 'Guardar borrador',
    'Publish Facility': 'Publicar instalación',

    // Submit feedback
    'Share user experiences, report platform bugs, or suggest improvements to the service.':
      'Comparte tu experiencia, informa errores de la plataforma o sugiere mejoras al servicio.',
    'Send Feedback to Wayfinder Operations': 'Envía comentarios a Operaciones de Wayfinder',
    'Feedback Category': 'Categoría del comentario',
    'Select category': 'Selecciona una categoría',
    'Select the part of the platform you are contacting us about':
      'Selecciona la parte de la plataforma sobre la que nos escribes',
    'Your Message': 'Tu mensaje',
    'Describe your experience, report a bed availability discrepancy, or suggest a platform improvement...':
      'Describe tu experiencia, informa una discrepancia en la disponibilidad de camas o sugiere una mejora a la plataforma...',
    'Provide as much detail as possible to help our Portland dispatch team':
      'Incluye todos los detalles posibles para ayudar a nuestro equipo de despacho de Portland',
    'Email Address': 'Correo electrónico',
    'name@example.com': 'nombre@ejemplo.com',
    'If you would like a response from our admin team at 415 NW 10th Ave':
      'Si deseas una respuesta de nuestro equipo administrativo en 415 NW 10th Ave',
    'Phone Number': 'Número de teléfono',
    'Optional phone number for urgent dispatch-related inquiries':
      'Número de teléfono opcional para consultas urgentes relacionadas con el despacho',

    // Track ride
    'Active Transport Dispatch': 'Despacho de transporte activo',
    'Driver En Route to Pickup': 'Conductor en camino al punto de recogida',
    'Where and when, in one line': 'Dónde y cuándo, en una línea',
    'Estimated arrival in 6 minutes via 2004 silver Toyota Prius':
      'Llegada estimada en 6 minutos en un Toyota Prius plateado 2004',
    '2 Verified': '2 verificadas',
    'Beds Reserved': 'Camas reservadas',
    'Live Hourly': 'En vivo, cada hora',
    'Network Status': 'Estado de la red',
    'Call Driver': 'Llamar al conductor',
    'volunteer driver Marcus Vance': 'conductor voluntario Marcus Vance',
    '3 mins away': 'a 3 minutos'
  };

  // Labels for the control itself.
  var UI = {
    en: { listen: 'Listen', pause: 'Pause', resume: 'Resume', stop: 'Stop', group: 'Language and read aloud',
          lang: 'Language', noVoice: 'No English voice is installed on this device.',
          noTts: 'Read aloud is not supported in this browser.' },
    es: { listen: 'Escuchar', pause: 'Pausar', resume: 'Reanudar', stop: 'Detener', group: 'Idioma y lectura en voz alta',
          lang: 'Idioma', noVoice: 'Este dispositivo no tiene una voz en español instalada.',
          noTts: 'Este navegador no admite la lectura en voz alta.' }
  };

  var STORE = 'wayfinder-lang';
  var synth = window.speechSynthesis;
  var lang = 'en';
  var bar;                 // the control element
  var textNodes = [];      // [{ node, en }]
  var attrNodes = [];      // [{ el, attr, en }]
  var titleEn = document.title;

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function skipped(el) {
    return !el || !!el.closest('.wfa, .wf-ico, svg, script, style, [aria-hidden="true"]');
  }

  /* ---- Translation -------------------------------------------------- */

  function collect() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      if (!norm(n.nodeValue)) continue;
      var p = n.parentElement;
      if (!p || p.closest('.wfa, .wf-ico, svg, script, style')) continue;
      textNodes.push({ node: n, en: n.nodeValue });
    }
    ['placeholder', 'title', 'aria-label', 'alt'].forEach(function (attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        if (el.closest('.wfa')) return;
        attrNodes.push({ el: el, attr: attr, en: el.getAttribute(attr) });
      });
    });
  }

  function tr(en) {
    if (lang !== 'es') return en;
    var es = ES[norm(en)];
    if (es === undefined) return en;
    // Keep the original leading and trailing whitespace.
    return en.match(/^\s*/)[0] + es + en.match(/\s*$/)[0];
  }

  function applyLang(next) {
    stop();
    lang = next === 'es' ? 'es' : 'en';
    try { localStorage.setItem(STORE, lang); } catch (e) {}
    document.documentElement.lang = lang;
    document.title = tr(titleEn);
    textNodes.forEach(function (t) { t.node.nodeValue = tr(t.en); });
    attrNodes.forEach(function (a) { a.el.setAttribute(a.attr, tr(a.en)); });
    render();
  }

  /* ---- Read aloud ---------------------------------------------------- */

  var queue = [];          // [{ text, el }]
  var pos = 0;
  var run = 0;             // bumps on every start/stop so stale events are ignored
  var state = 'idle';      // idle | playing | paused
  var lit = null;
  var note = '';

  function blockOf(el) {
    while (el && el !== document.body) {
      if (getComputedStyle(el).display.indexOf('inline') !== 0) return el;
      el = el.parentElement;
    }
    return document.body;
  }

  // Turn on-screen shorthand into something a voice reads naturally.
  function spoken(s) {
    var es = lang === 'es';
    return norm(s)
      .replace(/(\d)\s*mi\b/g, es ? '$1 millas' : '$1 miles')
      .replace(/\s*[·•—]\s*/g, ', ')
      .replace(/#(\d)/g, es ? 'número $1' : 'number $1')
      .replace(/n\.º/g, 'número')
      .replace(/&/g, es ? ' y ' : ' and ')
      .replace(/^\*$/, '');
  }

  // Long passages are split by sentence: some browsers cut off long utterances.
  function pieces(text) {
    if (text.length <= 220) return [text];
    return text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  }

  function buildQueue() {
    var out = [];
    var sel = window.getSelection && String(window.getSelection());
    if (sel && norm(sel)) {
      pieces(spoken(sel)).forEach(function (t) { out.push({ text: t, el: null }); });
      return out;
    }
    var last = null, buf = '';
    function flush() {
      var t = spoken(buf);
      if (t && last) pieces(t).forEach(function (p) { out.push({ text: p, el: last }); });
      buf = '';
    }
    textNodes.forEach(function (t) {
      var p = t.node.parentElement;
      if (skipped(p) || !p.getClientRects().length) return;
      var b = blockOf(p);
      if (b !== last) { flush(); last = b; }
      buf += ' ' + t.node.nodeValue;
    });
    flush();
    return out;
  }

  function pickVoice() {
    var voices = synth.getVoices();
    var prefs = lang === 'es' ? ['es-US', 'es-MX', 'es-419', 'es'] : ['en-US', 'en'];
    for (var i = 0; i < prefs.length; i++) {
      for (var j = 0; j < voices.length; j++) {
        if (voices[j].lang.replace('_', '-').indexOf(prefs[i]) === 0) return voices[j];
      }
    }
    return null;
  }

  function highlight(el) {
    if (lit) lit.classList.remove('wfa-reading');
    lit = el;
    if (lit) {
      lit.classList.add('wfa-reading');
      lit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function speakNext(id) {
    if (id !== run) return;
    if (pos >= queue.length) { stop(); return; }
    var item = queue[pos];
    var u = new SpeechSynthesisUtterance(item.text);
    var v = pickVoice();
    u.lang = v ? v.lang : (lang === 'es' ? 'es-US' : 'en-US');
    if (v) u.voice = v;
    u.onend = u.onerror = function () {
      if (id !== run) return;
      pos++;
      speakNext(id);
    };
    highlight(item.el);
    synth.speak(u);
  }

  function play() {
    if (!synth) { note = UI[lang].noTts; render(); return; }
    if (state === 'paused') { synth.resume(); state = 'playing'; render(); return; }
    if (state === 'playing') { synth.pause(); state = 'paused'; render(); return; }
    synth.cancel();
    queue = buildQueue();
    if (!queue.length) return;
    pos = 0;
    run++;
    state = 'playing';
    note = synth.getVoices().length && !pickVoice() ? UI[lang].noVoice : '';
    render();
    speakNext(run);
  }

  function stop() {
    run++;
    if (synth) synth.cancel();
    state = 'idle';
    note = '';
    highlight(null);
    render();
  }

  /* ---- Control ------------------------------------------------------- */

  var CSS =
    '.wfa{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;' +
    'font:500 13px/1 "DM Sans",ui-sans-serif,system-ui,sans-serif;max-width:calc(100vw - 32px)}' +
    '.wfa-row{display:flex;align-items:center;gap:6px;padding:6px;border-radius:999px;background:var(--wfa-bg);' +
    'border:1px solid var(--wfa-line);box-shadow:0 6px 24px rgba(0,0,0,.35)}' +
    '.wfa button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;' +
    'padding:0 12px;border-radius:999px;color:var(--wfa-ink);cursor:pointer;white-space:nowrap;font:inherit}' +
    '.wfa button:hover{background:var(--wfa-hover)}' +
    '.wfa button:focus-visible{outline:2px solid var(--wfa-accent);outline-offset:2px}' +
    '.wfa button[aria-pressed="true"],.wfa .wfa-play{background:var(--wfa-accent);color:var(--wfa-on-accent)}' +
    '.wfa .wfa-lang{padding:0 10px;font-weight:700;letter-spacing:.04em}' +
    '.wfa-sep{width:1px;height:20px;background:var(--wfa-line)}' +
    '.wfa-i{font-family:"Material Symbols Outlined";font-size:20px;font-weight:400;line-height:1;' +
    'font-feature-settings:"liga";-webkit-font-smoothing:antialiased}' +
    '.wfa-note{padding:8px 12px;border-radius:8px;background:var(--wfa-bg);border:1px solid var(--wfa-line);color:var(--wfa-ink);line-height:1.35}' +
    '.wfa-reading{outline:2px solid var(--wfa-accent);outline-offset:4px;border-radius:4px}' +
    '@media (max-width:420px){.wfa .wfa-label{display:none}}';

  function token(root, name, fallback) {
    var v = root ? getComputedStyle(root).getPropertyValue(name).trim() : '';
    return v || fallback;
  }

  function mount() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var wf = document.querySelector('.wf');
    bar = document.createElement('div');
    bar.className = 'wfa';
    bar.setAttribute('role', 'group');
    bar.style.setProperty('--wfa-bg', token(wf, '--hf-surface', '#1b2620'));
    bar.style.setProperty('--wfa-ink', token(wf, '--hf-ink', '#f1efe8'));
    bar.style.setProperty('--wfa-line', token(wf, '--hf-line', 'rgba(255,255,255,.18)'));
    bar.style.setProperty('--wfa-accent', token(wf, '--hf-primary', '#e8c170'));
    bar.style.setProperty('--wfa-on-accent', token(wf, '--hf-on-primary', '#111a15'));
    bar.style.setProperty('--wfa-hover', 'rgba(128,128,128,.22)');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'en' || act === 'es') applyLang(act);
      else if (act === 'play') play();
      else if (act === 'stop') stop();
    });
    // Keep the page selection alive when a button is pressed, so "Listen" can read it.
    bar.addEventListener('mousedown', function (e) { e.preventDefault(); });
    document.body.appendChild(bar);
  }

  function render() {
    if (!bar) return;
    var t = UI[lang];
    var playing = state === 'playing';
    var label = playing ? t.pause : state === 'paused' ? t.resume : t.listen;
    bar.setAttribute('aria-label', t.group);
    bar.innerHTML =
      (note ? '<div class="wfa-note" role="status">' + note + '</div>' : '') +
      '<div class="wfa-row">' +
      '<span class="wfa-i" aria-hidden="true" style="padding-left:8px;color:var(--wfa-ink)">translate</span>' +
      '<button class="wfa-lang" data-act="en" lang="en" aria-pressed="' + (lang === 'en') + '" aria-label="English">EN</button>' +
      '<button class="wfa-lang" data-act="es" lang="es" aria-pressed="' + (lang === 'es') + '" aria-label="Español">ES</button>' +
      '<span class="wfa-sep"></span>' +
      '<button class="wfa-play" data-act="play" aria-label="' + label + '">' +
      '<span class="wfa-i" aria-hidden="true">' + (playing ? 'pause' : 'volume_up') + '</span>' +
      '<span class="wfa-label">' + label + '</span></button>' +
      (state !== 'idle'
        ? '<button data-act="stop" aria-label="' + t.stop + '"><span class="wfa-i" aria-hidden="true">stop</span></button>'
        : '') +
      '</div>';
  }

  function init() {
    collect();
    mount();
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) {}
    var q = /[?&]lang=(en|es)\b/.exec(location.search);
    applyLang(q ? q[1] : saved || 'en');
    if (synth) {
      synth.getVoices(); // voices load lazily in some browsers
      window.addEventListener('pagehide', function () { synth.cancel(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
