export const DEMO_TRAILS = [
  {
    id: 'trail-001',
    name: 'Мусала - Седемте езера',
    shortDescription:
      'Класически маршрут до най-високия връх на Балканите с невероятни гледки към Рилските езера.',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
    difficulty: 'hard',
    activityType: 'hiking',
    distance: '18.4 km',
    elevation: '+1,840 m',
    duration: '7h 20m',
    region: 'Рила, Самоков',
    ecoScore: 7,
    ecoWarnings: 3,
    tags: ['Summit', 'Lakes', 'Alpine'],
    authorAvatar: 'https://i.pravatar.cc/32?img=1',
    authorName: 'Иван Петров',
    photoCount: 142,
    rating: 4.8,
    ratingCount: 312,
  },
  {
    id: 'trail-002',
    name: 'Витоша - Черни връх',
    shortDescription:
      'Достъпен маршрут над столицата. Панорамна гледка към София и Рила.',
    image:
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=80',
    difficulty: 'moderate',
    activityType: 'hiking',
    distance: '12.1 km',
    elevation: '+820 m',
    duration: '4h 10m',
    region: 'Витоша, София',
    ecoScore: 5,
    ecoWarnings: 8,
    tags: ['Near city', 'Forest', 'Summit'],
    authorAvatar: 'https://i.pravatar.cc/32?img=2',
    authorName: 'Мария Георгиева',
    photoCount: 89,
    rating: 4.5,
    ratingCount: 214,
  },
  {
    id: 'trail-003',
    name: 'Крайбрежна писта - Созопол',
    shortDescription:
      'Лесна крайбрежна пътека с гледки към Черно море, стари рибарски колиби и скалисти плажове.',
    image:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
    difficulty: 'easy',
    activityType: 'running',
    distance: '6.3 km',
    elevation: '+80 m',
    duration: '1h 05m',
    region: 'Созопол, Бургас',
    ecoScore: 9,
    ecoWarnings: 0,
    tags: ['Coastal', 'Scenic', 'Easy run'],
    authorAvatar: 'https://i.pravatar.cc/32?img=3',
    authorName: 'Стефан Димитров',
    photoCount: 67,
    rating: 4.6,
    ratingCount: 98,
  },
  {
    id: 'trail-004',
    name: 'Ком - Емине (участък Балкана)',
    shortDescription:
      'Отсечка от прочутия маршрут Ком-Емине през централния Балкан с вековни букови гори.',
    image:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&q=80',
    difficulty: 'extreme',
    activityType: 'hiking',
    distance: '24.7 km',
    elevation: '+2,100 m',
    duration: '9h 45m',
    region: 'Стара Планина, Казанлък',
    ecoScore: 8,
    ecoWarnings: 1,
    tags: ['Multi-day', 'Wilderness', 'Challenging'],
    authorAvatar: 'https://i.pravatar.cc/32?img=4',
    authorName: 'Александър Тодоров',
    photoCount: 204,
    rating: 4.9,
    ratingCount: 156,
  },
  {
    id: 'trail-005',
    name: 'Велосипедна алея - Пловдив',
    shortDescription:
      'Градска велосипедна алея покрай река Марица. Подходяща за всички нива.',
    image:
      'https://images.unsplash.com/photo-1471506480208-91b3a4cc78be?w=600&q=80',
    difficulty: 'easy',
    activityType: 'cycling',
    distance: '15.0 km',
    elevation: '+35 m',
    duration: '1h 00m',
    region: 'Пловдив',
    ecoScore: 8,
    ecoWarnings: 2,
    tags: ['Urban', 'Cycling', 'Family'],
    authorAvatar: 'https://i.pravatar.cc/32?img=5',
    authorName: 'Елена Станева',
    photoCount: 33,
    rating: 4.3,
    ratingCount: 77,
  },
]

export const DEMO_ANIMALS = [
  {
    id: 'animal-001',
    name: 'Кафява мечка',
    species: 'Ursus arctos',
    image:
      'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600&q=80',
    region: 'Рила, Родопи',
    lastSeen: '2 days ago',
    photoCount: 47,
    rarity: 'rare',
    conservationStatus: 'LC',
    shortDescription:
      'Среща се в горските пояси на Рила и Родопи. Активна сутрин и вечер. Не се приближавайте.',
  },
  {
    id: 'animal-002',
    name: 'Скален орел',
    species: 'Aquila chrysaetos',
    image:
      'https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=600&q=80',
    region: 'Стара Планина',
    lastSeen: '5 days ago',
    photoCount: 28,
    rarity: 'very_rare',
    conservationStatus: 'LC',
    shortDescription:
      'Величествен хищник, гнездящ по скалните масиви на Балкана. Видим при ясно небе.',
  },
  {
    id: 'animal-003',
    name: 'Дива коза',
    species: 'Rupicapra rupicapra',
    image:
      'https://images.unsplash.com/photo-1567878905558-52ba77e56c6d?w=600&q=80',
    region: 'Пирин',
    lastSeen: 'Today',
    photoCount: 93,
    rarity: 'uncommon',
    conservationStatus: 'LC',
    shortDescription:
      'Обитава алпийския пояс на Пирин и Рила. Лесно видима сутринта по каменистите склонове.',
  },
  {
    id: 'animal-004',
    name: 'Черен щъркел',
    species: 'Ciconia nigra',
    image:
      'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=600&q=80',
    region: 'Родопи, Странджа',
    lastSeen: '3 days ago',
    photoCount: 19,
    rarity: 'rare',
    conservationStatus: 'LC',
    shortDescription:
      'За разлика от белия щъркел, черният избягва хората. Гнезди в стари гори до потоци.',
  },
]

export const ECO_STATS = {
  reportsThisWeek: 24,
  eventsScheduled: 3,
  volunteersActive: 118,
  trailsCleaned: 7,
}

export const FILTER_OPTIONS = {
  activity: ['All', 'Hiking', 'Running', 'Cycling'],
  difficulty: ['All', 'Easy', 'Moderate', 'Hard', 'Extreme'],
  region: [
    'All',
    'Рила',
    'Пирин',
    'Витоша',
    'Стара Планинa',
    'Родопи',
    'Черноморие',
  ],
  sort: ['Popular', 'Newest', 'Nearest', 'Eco Score'],
}
