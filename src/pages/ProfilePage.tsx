import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Settings, Star, Eye, Heart, MessageCircle, Edit, Trash2, Plus, MapPin, Phone, Mail, Calendar, Building, Shield, Camera, ExternalLink, Save, X, AlertTriangle 
} from 'lucide-react';
import { supabase, profiles, listings } from '../lib/supabase';

// Tipuri de utilizatori
type UserType = 'individual' | 'dealer';

// Interfață pentru profilul utilizatorului
interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  description?: string;
  website?: string;
  memberSince: string;
  rating: number;
  reviews: number;
  verified: boolean;
  avatar_url?: string;
  seller_type: UserType;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
  };
  stats: {
    activeListings: number;
    soldListings: number;
    views: number;
    favorites: number;
  };
  dealerInfo?: {
    companyName: string;
    cui: string;
    address: string;
    openHours: string;
    services: string[];
    brands: string[];
  };
}

// Interfață pentru anunțuri
interface Listing {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: 'active' | 'sold' | 'pending';
  views_count: number;
  favorites_count: number;
  created_at: string;
}

// Funcții de validare
const validateProfileData = (data: Partial<UserProfile>) => {
  const errors: Record<string, string> = {};

  // Validare nume
  if (!data.name?.trim()) {
    errors.name = 'Numele este obligatoriu';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Numele trebuie să aibă cel puțin 2 caractere';
  } else if (data.name.trim().length > 50) {
    errors.name = 'Numele nu poate depăși 50 de caractere';
  } else if (!/^[a-zA-ZăâîșțĂÂÎȘȚ\s\-\.]+$/.test(data.name.trim())) {
    errors.name = 'Numele poate conține doar litere, spații, cratimă și punct';
  }

  // Validare telefon
  if (data.phone?.trim()) {
    const phoneRegex = /^(\+4|0)[0-9]{9}$/;
    const cleanPhone = data.phone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      errors.phone = 'Numărul de telefon nu este valid (ex: 0790454647 sau +40790454647)';
    }
  }

  // Validare locație
  if (data.location?.trim()) {
    if (data.location.trim().length < 2) {
      errors.location = 'Locația trebuie să aibă cel puțin 2 caractere';
    } else if (data.location.trim().length > 100) {
      errors.location = 'Locația nu poate depăși 100 de caractere';
    }
    
    // Lista orașelor din România pentru validare
    const romanianCities = [
      'București', 'Cluj-Napoca', 'Timișoara', 'Iași', 'Constanța', 'Craiova', 'Brașov', 'Galați',
      'Ploiești', 'Oradea', 'Bacău', 'Pitești', 'Arad', 'Sibiu', 'Târgu Mureș', 'Baia Mare',
      'Buzău', 'Botoșani', 'Satu Mare', 'Râmnicu Vâlcea', 'Drobeta-Turnu Severin', 'Suceava',
      'Piatra Neamț', 'Târgu Jiu', 'Tulcea', 'Focșani', 'Bistrița', 'Reșița', 'Alba Iulia',
      'Deva', 'Hunedoara', 'Slatina', 'Vaslui', 'Călărași', 'Giurgiu', 'Slobozia', 'Zalău',
      'Turda', 'Mediaș', 'Onești', 'Gheorgheni', 'Pașcani', 'Dej', 'Reghin', 'Roman'
    ];
    
    const locationLower = data.location.trim().toLowerCase();
    const isValidCity = romanianCities.some(city => 
      locationLower.includes(city.toLowerCase()) || 
      locationLower.includes('românia') || 
      locationLower.includes('romania') ||
      locationLower.includes('sector') ||
      locationLower.includes('județ') ||
      locationLower.includes('judet')
    );
    
    if (!isValidCity) {
      errors.location = 'Te rugăm să specifici un oraș din România (ex: București, Cluj-Napoca, Timișoara)';
    }
  }

  // Validare descriere
  if (data.description?.trim()) {
    if (data.description.trim().length < 10) {
      errors.description = 'Descrierea trebuie să aibă cel puțin 10 caractere';
    } else if (data.description.trim().length > 500) {
      errors.description = 'Descrierea nu poate depăși 500 de caractere';
    }
  }

  // Validare website
  if (data.website?.trim()) {
    const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    if (!urlRegex.test(data.website.trim())) {
      errors.website = 'Website-ul trebuie să fie o adresă URL validă (ex: https://exemplu.com)';
    }
  }

  return errors;
};

// Funcție pentru curățarea datelor
const sanitizeProfileData = (data: Partial<UserProfile>) => {
  return {
    name: data.name?.trim() || '',
    phone: data.phone?.replace(/[\s\-\(\)]/g, '') || '',
    location: data.location?.trim() || '',
    description: data.description?.trim() || '',
    website: data.website?.trim() || ''
  };
};

// Componenta principală pentru pagina de profil
const ProfilePage = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('listings');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userListingsData, setUserListingsData] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUserProfile();
  }, [id, navigate]);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Obținem utilizatorul curent
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser && !id) {
        // Dacă nu este autentificat și nu avem ID, redirecționăm la login
        navigate('/auth');
        return;
      }

      let targetUserId = id;
      let isOwner = false;

      if (!id && currentUser) {
        // Dacă nu avem ID în URL, încărcăm profilul utilizatorului curent
        targetUserId = currentUser.id;
        isOwner = true;
      } else if (id && currentUser && currentUser.id === id) {
        // Dacă ID-ul din URL este al utilizatorului curent
        isOwner = true;
      }

      setIsCurrentUser(isOwner);

      // Încărcăm profilul din baza de date
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq(id ? 'id' : 'user_id', targetUserId)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        setError('Profilul nu a putut fi încărcat');
        return;
      }

      if (!profileData) {
        setError('Profilul nu a fost găsit');
        return;
      }

      // Încărcăm anunțurile utilizatorului
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', profileData.id)
        .order('created_at', { ascending: false });

      if (listingsError) {
        console.error('Error loading listings:', listingsError);
      }

      // Calculăm statisticile
      const activeListings = listingsData?.filter(l => l.status === 'active').length || 0;
      const soldListings = listingsData?.filter(l => l.status === 'sold').length || 0;
      const totalViews = listingsData?.reduce((sum, l) => sum + (l.views_count || 0), 0) || 0;
      const totalFavorites = listingsData?.reduce((sum, l) => sum + (l.favorites_count || 0), 0) || 0;

      // Formatăm datele profilului
      const formattedProfile: UserProfile = {
        id: profileData.id,
        user_id: profileData.user_id,
        name: profileData.name || 'Utilizator',
        email: profileData.email || '',
        phone: profileData.phone || '',
        location: profileData.location || '',
        description: profileData.description || '',
        website: profileData.website || '',
        memberSince: new Date(profileData.created_at).toLocaleDateString('ro-RO', { 
          year: 'numeric', 
          month: 'long' 
        }),
        rating: profileData.rating || 0,
        reviews: profileData.reviews_count || 0,
        verified: profileData.verified || false,
        avatar_url: profileData.avatar_url,
        seller_type: profileData.seller_type || 'individual',
        stats: {
          activeListings,
          soldListings,
          views: totalViews,
          favorites: totalFavorites
        }
      };

      setUserProfile(formattedProfile);
      setUserListingsData(listingsData || []);

    } catch (err) {
      console.error('Error in loadUserProfile:', err);
      setError('A apărut o eroare la încărcarea profilului');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProfile = () => {
    if (userProfile) {
      setEditForm({
        name: userProfile.name,
        email: userProfile.email,
        phone: userProfile.phone,
        location: userProfile.location,
        description: userProfile.description,
        website: userProfile.website,
        socialLinks: userProfile.socialLinks
      });
      setIsEditing(true);
      setValidationErrors({});
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
    
    // Curățăm eroarea pentru câmpul modificat
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;

    try {
      setIsSaving(true);
      setError(null);
      setValidationErrors({});

      // Curățăm și validăm datele
      const sanitizedData = sanitizeProfileData(editForm);
      const errors = validateProfileData(sanitizedData);

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setIsSaving(false);
        return;
      }

      console.log('🔄 Updating profile with validated data:', sanitizedData);

      // Actualizăm profilul în baza de date folosind user_id
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: sanitizedData.name,
          phone: sanitizedData.phone,
          location: sanitizedData.location,
          description: sanitizedData.description,
          website: sanitizedData.website,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userProfile.user_id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating profile:', error);
        throw new Error(`Eroare la actualizarea profilului: ${error.message}`);
      }

      console.log('✅ Profile updated successfully:', data);

      // Actualizăm profilul local cu datele returnate
      if (data) {
        setUserProfile(prev => prev ? {
          ...prev,
          name: data.name,
          phone: data.phone,
          location: data.location,
          description: data.description,
          website: data.website
        } : null);

        // Actualizăm și localStorage dacă este utilizatorul curent
        if (isCurrentUser) {
          const userData = JSON.parse(localStorage.getItem('user') || '{}');
          userData.name = data.name;
          localStorage.setItem('user', JSON.stringify(userData));
        }
      }

      setIsEditing(false);
      
      // Afișăm mesaj de succes
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
      successMessage.innerHTML = `
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>Profilul a fost actualizat cu succes!</span>
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 4000);

    } catch (err: any) {
      console.error('💥 Error saving profile:', err);
      setError(err.message || 'A apărut o eroare la salvarea profilului');
      
      // Afișăm mesaj de eroare
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
      errorMessage.innerHTML = `
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${err.message || 'Eroare la actualizarea profilului'}</span>
      `;
      document.body.appendChild(errorMessage);
      
      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 6000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
    setError(null);
    setValidationErrors({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'sold': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Activ';
      case 'sold': return 'Vândut';
      case 'pending': return 'În așteptare';
      default: return 'Necunoscut';
    }
  };

  const formatPrice = (price: number) => {
    return `€${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Acum 1 zi';
    if (diffDays < 7) return `Acum ${diffDays} zile`;
    if (diffDays < 30) return `Acum ${Math.ceil(diffDays / 7)} săptămâni`;
    return date.toLocaleDateString('ro-RO');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nexar-light flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <div className="w-16 h-16 border-4 border-nexar-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Se încarcă profilul...</p>
        </div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-nexar-light flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {error || 'Profil negăsit'}
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'Utilizatorul căutat nu există sau profilul nu este disponibil.'}
          </p>
          <button 
            onClick={() => navigate('/')}
            className="bg-nexar-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-nexar-gold transition-colors"
          >
            Înapoi la pagina principală
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nexar-light py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Profile Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <img
                    src={userProfile.avatar_url || "https://images.pexels.com/photos/2116475/pexels-photo-2116475.jpeg"}
                    alt={userProfile.name}
                    className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-white shadow-md"
                  />
                  {userProfile.verified && (
                    <div className="absolute bottom-0 right-0 bg-green-500 text-white p-1 rounded-full">
                      <Shield className="h-4 w-4" />
                    </div>
                  )}
                  {isCurrentUser && (
                    <button className="absolute bottom-0 left-0 bg-nexar-accent text-white p-1 rounded-full hover:bg-nexar-gold transition-colors">
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full text-center text-xl font-bold border rounded-lg px-3 py-2 focus:ring-2 focus:ring-nexar-accent focus:border-transparent ${
                          validationErrors.name ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Numele tău"
                      />
                      {validationErrors.name && (
                        <p className="mt-1 text-xs text-red-600 flex items-center justify-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {validationErrors.name}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <h2 className="text-xl font-bold text-nexar-primary">{userProfile.name}</h2>
                )}
                
                <div className="flex items-center justify-center space-x-1 mt-1">
                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                  <span className="font-semibold">{userProfile.rating.toFixed(1)}</span>
                  <span className="text-gray-600">({userProfile.reviews} recenzii)</span>
                </div>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {userProfile.seller_type === 'dealer' ? 'Dealer Autorizat' : 'Vânzător Privat'}
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-nexar-accent flex-shrink-0 mt-0.5" />
                  {isEditing ? (
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editForm.location || ''}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nexar-accent focus:border-transparent ${
                          validationErrors.location ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="Orașul tău (ex: București, Cluj-Napoca)"
                      />
                      {validationErrors.location && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {validationErrors.location}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-700">{userProfile.location || 'Nu este specificată'}</span>
                  )}
                </div>
                
                <div className="flex items-start space-x-3">
                  <Phone className="h-5 w-5 text-nexar-accent flex-shrink-0 mt-0.5" />
                  {isEditing ? (
                    <div className="flex-1">
                      <input
                        type="tel"
                        value={editForm.phone || ''}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nexar-accent focus:border-transparent ${
                          validationErrors.phone ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="0790454647 sau +40790454647"
                      />
                      {validationErrors.phone && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {validationErrors.phone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-700">{userProfile.phone || 'Nu este specificat'}</span>
                  )}
                </div>
                
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-nexar-accent flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{userProfile.email}</span>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-nexar-accent flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Membru din {userProfile.memberSince}</span>
                </div>

                {(userProfile.website || isEditing) && (
                  <div className="flex items-start space-x-3">
                    <ExternalLink className="h-5 w-5 text-nexar-accent flex-shrink-0 mt-0.5" />
                    {isEditing ? (
                      <div className="flex-1">
                        <input
                          type="url"
                          value={editForm.website || ''}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nexar-accent focus:border-transparent ${
                            validationErrors.website ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="https://website.com"
                        />
                        {validationErrors.website && (
                          <p className="mt-1 text-xs text-red-600 flex items-center">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {validationErrors.website}
                          </p>
                        )}
                      </div>
                    ) : (
                      <a 
                        href={userProfile.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-nexar-accent hover:text-nexar-gold transition-colors"
                      >
                        {userProfile.website?.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Statistici */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 text-center">Statistici</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-white rounded-lg">
                    <div className="font-bold text-nexar-accent">{userProfile.stats.activeListings}</div>
                    <div className="text-xs text-gray-600">Anunțuri active</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <div className="font-bold text-nexar-accent">{userProfile.stats.soldListings}</div>
                    <div className="text-xs text-gray-600">Vândute</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <div className="font-bold text-nexar-accent">{userProfile.stats.views}</div>
                    <div className="text-xs text-gray-600">Vizualizări</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <div className="font-bold text-nexar-accent">{userProfile.stats.favorites}</div>
                    <div className="text-xs text-gray-600">Favorite</div>
                  </div>
                </div>
              </div>

              {isCurrentUser && (
                <div className="space-y-3">
                  {isEditing ? (
                    <div className="flex space-x-2">
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        <span>{isSaving ? 'Se salvează...' : 'Salvează'}</span>
                      </button>
                      <button 
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="flex-1 bg-gray-500 text-white py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                        <span>Anulează</span>
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleEditProfile}
                      className="w-full bg-nexar-primary text-white py-3 rounded-xl font-semibold hover:bg-nexar-secondary transition-colors flex items-center justify-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Editează Profilul</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Descriere profil */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-nexar-primary mb-4">
                Despre {userProfile.seller_type === 'dealer' ? 'Noi' : 'Mine'}
              </h2>
              {isEditing ? (
                <div>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className={`w-full border rounded-lg px-4 py-3 focus:ring-2 focus:ring-nexar-accent focus:border-transparent ${
                      validationErrors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Descrie-te pe scurt... (minim 10 caractere, maxim 500)"
                  />
                  {validationErrors.description && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      {validationErrors.description}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-gray-500 text-right">
                    {(editForm.description || '').length}/500 caractere
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed">
                  {userProfile.description || 'Nicio descriere adăugată încă.'}
                </p>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-lg mb-8">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('listings')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === 'listings'
                        ? 'border-nexar-accent text-nexar-accent'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Anunțuri ({userListingsData.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('reviews')}
                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === 'reviews'
                        ? 'border-nexar-accent text-nexar-accent'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Recenzii ({userProfile.reviews})
                  </button>
                  {isCurrentUser && (
                    <>
                      <button
                        onClick={() => setActiveTab('favorites')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                          activeTab === 'favorites'
                            ? 'border-nexar-accent text-nexar-accent'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Favorite
                      </button>
                      <button
                        onClick={() => setActiveTab('messages')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                          activeTab === 'messages'
                            ? 'border-nexar-accent text-nexar-accent'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Mesaje
                      </button>
                    </>
                  )}
                </nav>
              </div>

              <div className="p-6">
                {/* Listings Tab */}
                {activeTab === 'listings' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-semibold text-nexar-primary">
                        {isCurrentUser ? 'Anunțurile Mele' : `Anunțurile ${userProfile.name}`}
                      </h3>
                      {isCurrentUser && (
                        <button 
                          onClick={() => navigate('/adauga-anunt')}
                          className="bg-nexar-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-nexar-gold transition-colors flex items-center space-x-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>Anunț Nou</span>
                        </button>
                      )}
                    </div>

                    {userListingsData.length === 0 ? (
                      <div className="text-center py-12">
                        <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">
                          {isCurrentUser 
                            ? 'Nu ai anunțuri active. Adaugă primul tău anunț!' 
                            : 'Acest utilizator nu are anunțuri active.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userListingsData.map((listing) => (
                          <div key={listing.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-center space-x-4">
                              <img
                                src={listing.images?.[0] || "https://images.pexels.com/photos/2116475/pexels-photo-2116475.jpeg"}
                                alt={listing.title}
                                className="w-24 h-24 rounded-lg object-cover"
                              />
                              
                              <div className="flex-1">
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="text-lg font-semibold text-nexar-primary">{listing.title}</h4>
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(listing.status)}`}>
                                    {getStatusText(listing.status)}
                                  </span>
                                </div>
                                
                                <div className="text-xl font-bold text-nexar-accent mb-2">{formatPrice(listing.price)}</div>
                                
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center space-x-1">
                                    <Eye className="h-4 w-4" />
                                    <span>{listing.views_count || 0} vizualizări</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Heart className="h-4 w-4" />
                                    <span>{listing.favorites_count || 0} favorite</span>
                                  </div>
                                  <span>{formatDate(listing.created_at)}</span>
                                </div>
                              </div>
                              
                              {isCurrentUser && (
                                <div className="flex flex-col space-y-2">
                                  <button 
                                    onClick={() => navigate(`/anunt/${listing.id}`)}
                                    className="p-2 text-nexar-primary hover:bg-nexar-light rounded-lg transition-colors"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button className="p-2 text-nexar-primary hover:bg-nexar-light rounded-lg transition-colors">
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Reviews Tab */}
                {activeTab === 'reviews' && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-nexar-primary">
                      {isCurrentUser ? 'Recenziile Mele' : `Recenzii pentru ${userProfile.name}`}
                    </h3>
                    
                    <div className="text-center py-12">
                      <Star className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        {isCurrentUser 
                          ? 'Nu ai primit recenzii încă.' 
                          : 'Acest utilizator nu are recenzii încă.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Favorites Tab - Doar pentru utilizatorul curent */}
                {activeTab === 'favorites' && isCurrentUser && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-nexar-primary">Anunțuri Favorite</h3>
                    
                    <div className="text-center py-12">
                      <Heart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        Nu ai anunțuri favorite încă.
                      </p>
                    </div>
                  </div>
                )}

                {/* Messages Tab - Doar pentru utilizatorul curent */}
                {activeTab === 'messages' && isCurrentUser && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-nexar-primary">Mesaje</h3>
                    <div className="text-center py-12">
                      <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Nu ai mesaje noi</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;