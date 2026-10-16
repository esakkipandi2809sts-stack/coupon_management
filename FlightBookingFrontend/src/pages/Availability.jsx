// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { useLocation, useSearchParams } from 'react-router-dom';
// import {
//   ArrowLeftRight,
//   CalendarDays,
//   ChevronDown,
//   Plane,
//   PlaneLanding,
//   PlaneTakeoff,
//   Plus,
//   Search,
//   Users,
//   X,
// } from 'lucide-react';
// import { flightApi } from '../services/api';
// import FlightCard from '../components/FlightCard';
// import './Availability.css';

// const TRIP_TYPES = ['One Way', 'Round Trip', 'Multicity',];
// const createSegment = (fromCity = '', toCity = '', departureDate = '') => ({
//   id: crypto.randomUUID(),
//   fromCity,
//   toCity,
//   departureDate,
// });


// const CABIN_CLASSES = [
//   "All",
//   "Economy",
//   "Premium Economy",
//   "Business",
//   "First",
// ];

// function getTodayDate() {
//   const now = new Date();
//   return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
// }

// function flightDurationMinutes(flight) {
//   const text = String(flight.duration || '');
//   const hours = Number(text.match(/(\d+)\s*h/i)?.[1] || 0);
//   const minutes = Number(text.match(/(\d+)\s*m/i)?.[1] || 0);
//   return hours * 60 + minutes;
// }

// function sortFlights(flights, sortBy) {
//   return [...flights].sort((left, right) => {
//     if (sortBy === 'price-desc') return Number(right.price) - Number(left.price);
//     if (sortBy === 'duration') return flightDurationMinutes(left) - flightDurationMinutes(right);
//     return Number(left.price) - Number(right.price);
//   });
// }

// function LocationField({ label, value, onChange, options, loading, icon: Icon, listId }) {
//   const optionListId = listId || `locations-${label.toLowerCase().replace(/\s/g, '-')}`;
//   return (
//     <label className="availability-field">
//       <span className="availability-label">{label}</span>
//       <span className="availability-input-wrap">
//         <Icon className="availability-input-icon" size={18} aria-hidden="true" />
//         <input
//           required
//           type="text"
//           list={optionListId}
//           value={value}
//           onChange={(event) => onChange(event.target.value)}
//           placeholder={loading ? 'Loading locations…' : 'Enter city or airport code'}
//           autoComplete="off"
//         />
//         <datalist id={optionListId}>
//           {options.map((option) => <option key={option} value={option} />)}
//         </datalist>
//       </span>
//     </label>
//   );
// }

// function DateField({ label, value, onChange, min }) {
//   return (
//     <label className="availability-field">
//       <span className="availability-label">{label}</span>
//       <span className="availability-input-wrap">
//         <CalendarDays className="availability-input-icon" size={18} aria-hidden="true" />
//         <input
//           required
//           type="date"
//           value={value}
//           min={min}
//           onChange={(event) => onChange(event.target.value)}
//         />
//       </span>
//     </label>
//   );
// }

// function CountField({ label, hint, value, min = 0, onChange }) {
//   return (
//     <label className="availability-field availability-count-field">
//       <span className="availability-label">{label}</span>
//       <span className="availability-count-hint">{hint}</span>
//       <span className="availability-input-wrap">
//         <Users className="availability-input-icon" size={18} aria-hidden="true" />
//         <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
//           {Array.from({ length: 10 - min }, (_, index) => index + min).map((count) => (
//             <option key={count} value={count}>{count}</option>
//           ))}
//         </select>
//         <ChevronDown className="availability-select-chevron" size={15} aria-hidden="true" />
//       </span>
//     </label>
//   );
// }



// export default function Availability() {
//   const [searchParams] = useSearchParams();
//   const location = useLocation();
//   const [tripType, setTripType] = useState('One Way');
//   const [segments, setSegments] = useState([createSegment(searchParams.get('search') || '', '', '')]);
//   const [returnDate, setReturnDate] = useState('');
//   const [adults, setAdults] = useState(1);
//   const [children, setChildren] = useState(0);
//   const [infants, setInfants] = useState(0);
//   const [airline, setAirline] = useState('');
//   const [directFlight, setDirectFlight] = useState(false);
//   const [locations, setLocations] = useState([]);
//   const [airlines, setAirlines] = useState([]);
//   const [optionsLoading, setOptionsLoading] = useState(true);
//   const [optionsError, setOptionsError] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [resultSections, setResultSections] = useState([]);
//   const [hasSearched, setHasSearched] = useState(false);
//   const [error, setError] = useState('');
//   const [sortBy, setSortBy] = useState('price-asc');
//   const requestId = useRef(0);

//   useEffect(() => {
//     let active = true;
//     flightApi.getSearchOptions()
//       .then(({ data }) => {
//         if (!active) return;
//         setLocations(data.locations || []);
//         setAirlines(data.airlines || []);
//         setOptionsError('');
//       })
//       .catch((err) => {
//         if (active) {
//           setOptionsError(err.response?.data?.message || 'Unable to load airport and airline choices.');
//         }
//       })
//       .finally(() => {
//         if (active) setOptionsLoading(false);
//       });
//     return () => { active = false; };
//   }, []);

//   const totalPassengers = adults + children + infants;
//   const today = useMemo(() => getTodayDate(), []);
//   const isMultiCity = tripType === 'Multicity';
//   const primarySegment = segments[0];

//   const updateSegment = (id, field, value) => {
//     setSegments((current) => current.map((segment) => (
//       segment.id === id ? { ...segment, [field]: value } : segment
//     )));
//     clearResults();
//   };

//   const clearResults = () => {
//     requestId.current += 1;
//     setLoading(false);
//     setHasSearched(false);
//     setResultSections([]);
//     setError('');
//   };

//   const updateTripType = (type) => {
//     setTripType(type);
//     if (type === 'Multicity' && segments.length < 2) {
//       setSegments((current) => [...current, createSegment()]);
//     }
//     clearResults();
//   };

//   const handleSwap = (id = primarySegment.id) => {
//     setSegments((current) => current.map((segment) => (
//       segment.id === id
//         ? { ...segment, fromCity: segment.toCity, toCity: segment.fromCity }
//         : segment
//     )));
//     clearResults();
//   };

//   const handleAddSegment = () => {
//     const previous = segments[segments.length - 1];
//     setSegments((current) => [
//       ...current,
//       createSegment(previous?.toCity || '', '', previous?.departureDate || ''),
//     ]);
//     clearResults();
//   };

//   const handleRemoveSegment = (id) => {
//     if (segments.length <= 2) return;
//     setSegments((current) => current.filter((segment) => segment.id !== id));
//     clearResults();
//   };

//   const resetSearch = () => {
//     setTripType('One Way');
//     setSegments([createSegment()]);
//     setReturnDate('');
//     setAdults(1);
//     setChildren(0);
//     setInfants(0);
//     setAirline('');
//     setSpecialFare('');
//     setAgencyName('');
//     setDirectFlight(false);
//     setHostSearch(false);
//     setSortBy('price-asc');
//     clearResults();
//   };

//   const validateSearch = () => {
//     if (adults < 1) return 'Select at least one adult passenger.';
//     if (totalPassengers < 1 || totalPassengers > 27) return 'Passenger total must be between 1 and 27.';
//     if (segments.some((segment) => !segment.fromCity.trim() || !segment.toCity.trim())) {
//       return 'Enter an origin and destination for each flight segment.';
//     }
//     if (segments.some((segment) => segment.fromCity.trim().toLowerCase() === segment.toCity.trim().toLowerCase())) {
//       return 'Origin and destination must be different.';
//     }
//     if (segments.some((segment) => !segment.departureDate)) return 'Select a departure date for each segment.';
//     if (segments.some((segment) => segment.departureDate < today)) return 'Departure dates cannot be in the past.';
//     if (tripType === 'Round Trip') {
//       if (!returnDate) return 'Select a return date for your round trip.';
//       if (returnDate < primarySegment.departureDate) return 'Return date cannot be earlier than departure date.';
//       if (returnDate < today) return 'Return date cannot be in the past.';
//     }
//     return '';
//   };

//   const makeQuery = (segment, date, fromCity = segment.fromCity, toCity = segment.toCity) => ({
//     fromCity: fromCity.trim(),
//     toCity: toCity.trim(),
//     departureDate: date,
//     passengers: totalPassengers,
//     adults,
//     children,
//     infants,
//     airline: airline || undefined,
//     directFlight,
//   });

//   const handleSearch = async (event) => {
//     event.preventDefault();
//     setError('');
//     const validationMessage = validateSearch();
//     if (validationMessage) {
//       setError(validationMessage);
//       setHasSearched(false);
//       return;
//     }

//     const currentRequest = ++requestId.current;
//     setLoading(true);
//     setHasSearched(true);
//     setResultSections([]);

//     try {
//       let sections;
//       if (tripType === 'Multicity') {
//         sections = await Promise.all(segments.map(async (segment, index) => {
//           const { data } = await flightApi.search(makeQuery(segment, segment.departureDate));
//           return { id: segment.id, title: `Segment ${index + 1}: ${segment.fromCity} to ${segment.toCity}`, flights: data };
//         }));
//       } else {
//         const outbound = await flightApi.search(makeQuery(primarySegment, primarySegment.departureDate));
//         sections = [{ id: 'outbound', title: tripType === 'Round Trip' ? 'Outbound flights' : 'Available flights', flights: outbound.data }];

//         if (tripType === 'Round Trip') {
//           const inbound = await flightApi.search(
//             makeQuery(primarySegment, returnDate, primarySegment.toCity, primarySegment.fromCity),
//           );
//           sections.push({ id: 'return', title: 'Return flights', flights: inbound.data });
//         }
//       }

//       if (currentRequest === requestId.current) setResultSections(sections);
//     } catch (err) {
//       if (currentRequest === requestId.current) {
//         setResultSections([]);
//         setError(err.response?.data?.message || 'Unable to search flights. Please try again.');
//       }
//     } finally {
//       if (currentRequest === requestId.current) setLoading(false);
//     }
//   };

//   const resultCount = resultSections.reduce((count, section) => count + section.flights.length, 0);

//   const [selectedCabin, setSelectedCabin] = useState("All");
//   const [tempCabin, setTempCabin] = useState("All");
//   const [dropdownOpen, setDropdownOpen] = useState(false);

//   const dropdownRef = useRef(null);

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handleOutsideClick = (event) => {
//       if (
//         dropdownRef.current &&
//         !dropdownRef.current.contains(event.target)
//       ) {
//         setDropdownOpen(false);
//         setTempCabin(selectedCabin);
//       }
//     };

//     document.addEventListener("mousedown", handleOutsideClick);

//     return () => {
//       document.removeEventListener("mousedown", handleOutsideClick);
//     };
//   }, [selectedCabin]);

//   const openDropdown = () => {
//     if (dropdownOpen) {
//       setDropdownOpen(false);
//     } else {
//       setTempCabin(selectedCabin);
//       setDropdownOpen(true);
//     }
//   };

//   return (
//     <div className="availability-page animate-fade-in">
//       <header className="availability-page-header">
//         <h1>Flight Availability &amp; Schedules</h1>
//         <p>Search scheduled flights using live availability from the booking database.</p>
//       </header>

//       {location.state?.accessDenied && (
//         <p className="availability-error" role="alert">Access denied: you do not have permission to access that page.</p>
//       )}

//       <section className="availability-search-card" aria-label="Search flights">
//         <nav className="availability-trip-tabs" aria-label="Trip type">
//           {TRIP_TYPES.map((type) => (
//             <button
//               type="button"
//               key={type}
//               className={`availability-trip-tab${tripType === type ? ' is-active' : ''}`}
//               aria-pressed={tripType === type}
//               onClick={() => updateTripType(type)}
//             >
//               {type}
//             </button>
//           ))}
//         </nav>

//         {optionsError && <p className="availability-error" role="alert">{optionsError}</p>}

//         <form onSubmit={handleSearch} noValidate>
//           {isMultiCity ? (
//             <div className="availability-segments">
//               {segments.map((segment, index) => (
//                 <div className="availability-segment-row" key={segment.id}>
//                   <span className="availability-segment-number">Flight {index + 1}</span>
//                   <LocationField
//                     label="Enter Origin"
//                     value={segment.fromCity}
//                     onChange={(value) => updateSegment(segment.id, 'fromCity', value)}
//                     options={locations}
//                     loading={optionsLoading}
//                     icon={PlaneTakeoff}
//                     listId={`locations-${segment.id}-origin`}
//                   />
//                   <button
//                     className="availability-swap"
//                     type="button"
//                     onClick={() => handleSwap(segment.id)}
//                     aria-label={`Swap origin and destination for segment ${index + 1}`}
//                     title="Swap origin and destination"
//                   >
//                     <ArrowLeftRight size={18} />
//                   </button>
//                   <LocationField
//                     label="Enter Destination"
//                     value={segment.toCity}
//                     onChange={(value) => updateSegment(segment.id, 'toCity', value)}
//                     options={locations}
//                     loading={optionsLoading}
//                     icon={PlaneLanding}
//                     listId={`locations-${segment.id}-destination`}
//                   />
//                   <DateField
//                     label="Departure Date"
//                     value={segment.departureDate}
//                     min={today}
//                     onChange={(value) => updateSegment(segment.id, 'departureDate', value)}
//                   />
//                   {segments.length > 2 && (
//                     <button
//                       className="availability-remove-segment"
//                       type="button"
//                       onClick={() => handleRemoveSegment(segment.id)}
//                       aria-label={`Remove segment ${index + 1}`}
//                     >
//                       <X size={17} />
//                     </button>
//                   )}
//                 </div>
//               ))}
//               <button className="availability-add-segment" type="button" onClick={handleAddSegment}>
//                 <Plus size={16} /> Add flight segment
//               </button>
//             </div>
//           ) : (
//             <div className={`availability-main-row${tripType === 'Round Trip' ? ' has-return' : ''}`}>
//               <LocationField
//                 label="Enter Origin"
//                 value={primarySegment.fromCity}
//                 onChange={(value) => updateSegment(primarySegment.id, 'fromCity', value)}
//                 options={locations}
//                 loading={optionsLoading}
//                 icon={PlaneTakeoff}
//                 listId="locations-primary-origin"
//               />
//               <button
//                 className="availability-swap"
//                 type="button"
//                 onClick={() => handleSwap()}
//                 aria-label="Swap origin and destination"
//                 title="Swap origin and destination"
//               >
//                 <ArrowLeftRight size={18} />
//               </button>
//               <LocationField
//                 label="Enter Destination"
//                 value={primarySegment.toCity}
//                 onChange={(value) => updateSegment(primarySegment.id, 'toCity', value)}
//                 options={locations}
//                 loading={optionsLoading}
//                 icon={PlaneLanding}
//                 listId="locations-primary-destination"
//               />
//               <DateField
//                 label="Departure Date"
//                 value={primarySegment.departureDate}
//                 min={today}
//                 onChange={(value) => updateSegment(primarySegment.id, 'departureDate', value)}
//               />
//               {tripType === 'Round Trip' && (
//                 <DateField
//                   label="Return Date"
//                   value={returnDate}
//                   min={primarySegment.departureDate || today}
//                   onChange={(value) => {
//                     setReturnDate(value);
//                     setHasSearched(false);
//                   }}
//                 />
//               )}
//               <div className="availability-passengers">
//                 <div className="availability-label">Passengers</div>
//                 <div className="availability-passenger-counts">
//                   <CountField label="Adults" hint="12+ years" value={adults} min={1} onChange={setAdults} />
//                   <CountField label="Children" hint="2–12 years" value={children} onChange={setChildren} />
//                   <CountField label="Infants" hint="Under 2" value={infants} onChange={setInfants} />
//                 </div>
//               </div>
//             </div>
//           )}

//           {isMultiCity && (
//             <div className="availability-passengers availability-multicity-passengers">
//               <div className="availability-label">Passengers</div>
//               <div className="availability-passenger-counts">
//                 <CountField label="Adults" hint="12+ years" value={adults} min={1} onChange={setAdults} />
//                 <CountField label="Children" hint="2–12 years" value={children} onChange={setChildren} />
//                 <CountField label="Infants" hint="Under 2" value={infants} onChange={setInfants} />
//               </div>
//             </div>
//           )}


//           <div className="availability-additional">
//             <label className="availability-field">
//               <span className="availability-label">Travellers</span>

//               <div className="travellers-field" ref={dropdownRef}>
//                 <button
//                   type="button"
//                   id="travellers-input"
//                   className="travellers-input"
//                   onClick={openDropdown}
//                   aria-expanded={dropdownOpen}
//                   aria-haspopup="dialog"
//                 >
//                   <span>{selectedCabin}</span>
//                   <span className="dropdown-arrow">
//                     {dropdownOpen ? "▲" : "▼"}
//                   </span>
//                 </button>

//                 {dropdownOpen && (
//                   <div className="travellers-dropdown" role="dialog">
//                     <h4>Select Class</h4>

//                     <div className="cabin-options">
//                       {CABIN_CLASSES.map((cabin) => (
//                         <label
//                           key={cabin}
//                           className={`cabin-option ${selectedCabin === cabin ? "selected" : ""
//                             }`}
//                         >
//                           <input
//                             type="radio"
//                             name="cabinClass"
//                             value={cabin}
//                             checked={selectedCabin === cabin}
//                             onChange={() => {
//                               setSelectedCabin(cabin);
//                               setDropdownOpen(false);
//                             }}
//                           />

//                           <span>{cabin}</span>
//                         </label>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             </label>


//             <label className="availability-field">
//               <span className="availability-label">Airline</span>
//               <span className="availability-input-wrap">
//                 <Plane className="availability-input-icon" size={17} aria-hidden="true" />
//                 <select value={airline} onChange={(event) => setAirline(event.target.value)}>
//                   <option value="">All airlines</option>
//                   {airlines.map((name) => <option key={name} value={name}>{name}</option>)}
//                 </select>
//                 <ChevronDown className="availability-select-chevron" size={15} aria-hidden="true" />
//               </span>
//             </label>
//           </div>

//           <div className="availability-form-actions">
//             <button className="availability-submit" type="submit" disabled={loading || optionsLoading}>
//               <Search size={18} />
//               {loading ? 'Searching flights…' : 'Search Flight'}
//             </button>
//           </div>
//         </form>
//       </section>

//       {hasSearched && !error && (
//         <section className="availability-results" aria-live="polite">


//           {tripType === 'Round Trip' && (
//             <p className="availability-note">
//               Outbound and return options are searched separately. The current booking flow books each ticket individually.
//             </p>
//           )}

//           {loading && (
//             <div className="availability-empty-state"><Search size={26} /><p>Searching scheduled flights…</p></div>
//           )}
//           {!loading && resultSections.map((section) => (
//             <section className="availability-result-section" key={section.id}>
//               <h3>{section.title} <span>({section.flights.length})</span></h3>
//               {section.flights.length > 0 ? (
//                 <div className="availability-flight-list">
//                   {sortFlights(section.flights, sortBy).map((flight) => (
//                     <FlightCard key={flight.flightId} flight={flight} couponCode={location.state?.couponCode} selectedCabin={selectedCabin} passengerCount={totalPassengers} />
//                   ))}
//                 </div>
//               ) : (
//                 <div className="availability-empty-state">
//                   <Search size={26} />
//                   <p>No matching scheduled flights are available for this route and date.</p>
//                 </div>
//               )}
//             </section>
//           ))}
//         </section>
//       )}
//     </div>
//   );
// }



import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { flightApi } from '../services/api';
import FlightCard from '../components/FlightCard';
import './Availability.css';

const TRIP_TYPES = ['One Way', 'Round Trip', 'Multicity'];

const CABIN_CLASSES = [
  'All',
  'Economy',
  'Premium Economy',
  'Business',
  'First',
];

const createSegment = (
  fromCity = '',
  toCity = '',
  departureDate = ''
) => ({
  id: crypto.randomUUID(),
  fromCity,
  toCity,
  departureDate,
});

function getTodayDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function flightDurationMinutes(flight) {
  const text = String(flight.duration || '');
  const hours = Number(text.match(/(\d+)\s*h/i)?.[1] || 0);
  const minutes = Number(text.match(/(\d+)\s*m/i)?.[1] || 0);

  return hours * 60 + minutes;
}

function sortFlights(flights, sortBy) {
  return [...flights].sort((left, right) => {
    if (sortBy === 'price-desc') {
      return Number(right.price) - Number(left.price);
    }

    if (sortBy === 'duration') {
      return flightDurationMinutes(left) - flightDurationMinutes(right);
    }

    return Number(left.price) - Number(right.price);
  });
}

function LocationField({
  label,
  value,
  onChange,
  options,
  loading,
  icon: Icon,
  listId,
}) {
  const optionListId =
    listId || `locations-${label.toLowerCase().replace(/\s/g, '-')}`;

  return (
    <label className="availability-field">
      <span className="availability-label">{label}</span>

      <span className="availability-input-wrap">
        <Icon
          className="availability-input-icon"
          size={18}
          aria-hidden="true"
        />

        <input
          required
          type="text"
          list={optionListId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            loading ? 'Loading locations…' : 'Enter city or airport code'
          }
          autoComplete="off"
        />

        <datalist id={optionListId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </span>
    </label>
  );
}

function DateField({ label, value, onChange, min }) {
  return (
    <label className="availability-field">
      <span className="availability-label">{label}</span>

      <span className="availability-input-wrap">
        <CalendarDays
          className="availability-input-icon"
          size={18}
          aria-hidden="true"
        />

        <input
          required
          type="date"
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function CountField({
  label,
  hint,
  value,
  min = 0,
  onChange,
}) {
  return (
    <label className="availability-field availability-count-field">
      <span className="availability-label">{label}</span>
      <span className="availability-count-hint">{hint}</span>

      <span className="availability-input-wrap">
        <Users className="availability-input-icon" size={18} aria-hidden="true" />

        <select
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {Array.from(
            { length: 10 - min },
            (_, index) => index + min
          ).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>

        <ChevronDown
          className="availability-select-chevron"
          size={15}
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export default function Availability() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [tripType, setTripType] = useState('One Way');

  const [segments, setSegments] = useState([
    createSegment(searchParams.get('search') || '', '', ''),
  ]);

  const [returnDate, setReturnDate] = useState('');

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [airline, setAirline] = useState('');
  const [directFlight, setDirectFlight] = useState(false);

  const [locations, setLocations] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');

  const [loading, setLoading] = useState(false);
  const [resultSections, setResultSections] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('price-asc');

  // Current dropdown selection.
  const [selectedCabin, setSelectedCabin] = useState('All');

  // Cabin class used by the last submitted flight search.
  const [searchedCabin, setSearchedCabin] = useState('All');

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const requestId = useRef(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let active = true;

    flightApi
      .getSearchOptions()
      .then(({ data }) => {
        if (!active) return;

        setLocations(data.locations || []);
        setAirlines(data.airlines || []);
        setOptionsError('');
      })
      .catch((err) => {
        if (active) {
          setOptionsError(
            err.response?.data?.message ||
              'Unable to load airport and airline choices.'
          );
        }
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Close the cabin dropdown when clicking outside.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const totalPassengers = adults + children + infants;
  const today = useMemo(() => getTodayDate(), []);

  const isMultiCity = tripType === 'Multicity';
  const primarySegment = segments[0];

  const clearResults = () => {
    requestId.current += 1;
    setLoading(false);
    setHasSearched(false);
    setResultSections([]);
    setError('');
  };

  const updateSegment = (id, field, value) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === id ? { ...segment, [field]: value } : segment
      )
    );

    clearResults();
  };

  const updateTripType = (type) => {
    setTripType(type);

    if (type === 'Multicity' && segments.length < 2) {
      setSegments((current) => [...current, createSegment()]);
    }

    clearResults();
  };

  const handleSwap = (id = primarySegment.id) => {
    setSegments((current) =>
      current.map((segment) =>
        segment.id === id
          ? {
              ...segment,
              fromCity: segment.toCity,
              toCity: segment.fromCity,
            }
          : segment
      )
    );

    clearResults();
  };

  const handleAddSegment = () => {
    const previous = segments[segments.length - 1];

    setSegments((current) => [
      ...current,
      createSegment(
        previous?.toCity || '',
        '',
        previous?.departureDate || ''
      ),
    ]);

    clearResults();
  };

  const handleRemoveSegment = (id) => {
    if (segments.length <= 2) return;

    setSegments((current) =>
      current.filter((segment) => segment.id !== id)
    );

    clearResults();
  };

  const resetSearch = () => {
    setTripType('One Way');
    setSegments([createSegment()]);
    setReturnDate('');
    setAdults(1);
    setChildren(0);
    setInfants(0);
    setAirline('');
    setDirectFlight(false);
    setSortBy('price-asc');
    setSelectedCabin('All');
    setSearchedCabin('All');
    setDropdownOpen(false);
    clearResults();
  };

  const validateSearch = () => {
    if (adults < 1) {
      return 'Select at least one adult passenger.';
    }

    if (totalPassengers < 1 || totalPassengers > 27) {
      return 'Passenger total must be between 1 and 27.';
    }

    if (
      segments.some(
        (segment) =>
          !segment.fromCity.trim() || !segment.toCity.trim()
      )
    ) {
      return 'Enter an origin and destination for each flight segment.';
    }

    if (
      segments.some(
        (segment) =>
          segment.fromCity.trim().toLowerCase() ===
          segment.toCity.trim().toLowerCase()
      )
    ) {
      return 'Origin and destination must be different.';
    }

    if (segments.some((segment) => !segment.departureDate)) {
      return 'Select a departure date for each segment.';
    }

    if (segments.some((segment) => segment.departureDate < today)) {
      return 'Departure dates cannot be in the past.';
    }

    if (tripType === 'Round Trip') {
      if (!returnDate) {
        return 'Select a return date for your round trip.';
      }

      if (returnDate < primarySegment.departureDate) {
        return 'Return date cannot be earlier than departure date.';
      }

      if (returnDate < today) {
        return 'Return date cannot be in the past.';
      }
    }

    return '';
  };

  const makeQuery = (
    segment,
    date,
    fromCity = segment.fromCity,
    toCity = segment.toCity
  ) => ({
    fromCity: fromCity.trim(),
    toCity: toCity.trim(),
    departureDate: date,
    passengers: totalPassengers,
    adults,
    children,
    infants,
    airline: airline || undefined,
    directFlight,
  });

  const handleSearch = async (event) => {
    event.preventDefault();

    setError('');

    const validationMessage = validateSearch();

    if (validationMessage) {
      setError(validationMessage);
      setHasSearched(false);
      return;
    }

    // Snapshot the selected class at the moment Search is clicked.
    const cabinForThisSearch = selectedCabin;

    setSearchedCabin(cabinForThisSearch);

    const currentRequest = ++requestId.current;

    setLoading(true);
    setHasSearched(true);
    setResultSections([]);

    try {
      let sections;

      if (tripType === 'Multicity') {
        sections = await Promise.all(
          segments.map(async (segment, index) => {
            const { data } = await flightApi.search(
              makeQuery(segment, segment.departureDate)
            );

            return {
              id: segment.id,
              title: `Segment ${index + 1}: ${segment.fromCity} to ${segment.toCity}`,
              flights: data,
            };
          })
        );
      } else {
        const outbound = await flightApi.search(
          makeQuery(primarySegment, primarySegment.departureDate)
        );

        sections = [
          {
            id: 'outbound',
            title:
              tripType === 'Round Trip'
                ? 'Outbound flights'
                : 'Available flights',
            flights: outbound.data,
          },
        ];

        if (tripType === 'Round Trip') {
          const inbound = await flightApi.search(
            makeQuery(
              primarySegment,
              returnDate,
              primarySegment.toCity,
              primarySegment.fromCity
            )
          );

          sections.push({
            id: 'return',
            title: 'Return flights',
            flights: inbound.data,
          });
        }
      }

      if (currentRequest === requestId.current) {
        setResultSections(sections);
      }
    } catch (err) {
      if (currentRequest === requestId.current) {
        setResultSections([]);

        setError(
          err.response?.data?.message ||
            'Unable to search flights. Please try again.'
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  };

  const resultCount = resultSections.reduce(
    (count, section) => count + section.flights.length,
    0
  );

  const openDropdown = () => {
    setDropdownOpen((open) => !open);
  };

  return (
    <div className="availability-page animate-fade-in">
      <header className="availability-page-header">
        <h1>Flight Availability &amp; Schedules</h1>
        <p>
          Search scheduled flights using live availability from the booking
          database.
        </p>
      </header>

      {location.state?.accessDenied && (
        <p className="availability-error" role="alert">
          Access denied: you do not have permission to access that page.
        </p>
      )}

      {error && (
        <p className="availability-error" role="alert">
          {error}
        </p>
      )}

      <section
        className="availability-search-card"
        aria-label="Search flights"
      >
        <nav className="availability-trip-tabs" aria-label="Trip type">
          {TRIP_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              className={`availability-trip-tab${
                tripType === type ? ' is-active' : ''
              }`}
              aria-pressed={tripType === type}
              onClick={() => updateTripType(type)}
            >
              {type}
            </button>
          ))}
        </nav>

        {optionsError && (
          <p className="availability-error" role="alert">
            {optionsError}
          </p>
        )}

        <form onSubmit={handleSearch} noValidate>
          {isMultiCity ? (
            <div className="availability-segments">
              {segments.map((segment, index) => (
                <div
                  className="availability-segment-row"
                  key={segment.id}
                >
                  <span className="availability-segment-number">
                    Flight {index + 1}
                  </span>

                  <LocationField
                    label="Enter Origin"
                    value={segment.fromCity}
                    onChange={(value) =>
                      updateSegment(segment.id, 'fromCity', value)
                    }
                    options={locations}
                    loading={optionsLoading}
                    icon={PlaneTakeoff}
                    listId={`locations-${segment.id}-origin`}
                  />

                  <button
                    className="availability-swap"
                    type="button"
                    onClick={() => handleSwap(segment.id)}
                    aria-label={`Swap origin and destination for segment ${
                      index + 1
                    }`}
                    title="Swap origin and destination"
                  >
                    <ArrowLeftRight size={18} />
                  </button>

                  <LocationField
                    label="Enter Destination"
                    value={segment.toCity}
                    onChange={(value) =>
                      updateSegment(segment.id, 'toCity', value)
                    }
                    options={locations}
                    loading={optionsLoading}
                    icon={PlaneLanding}
                    listId={`locations-${segment.id}-destination`}
                  />

                  <DateField
                    label="Departure Date"
                    value={segment.departureDate}
                    min={today}
                    onChange={(value) =>
                      updateSegment(segment.id, 'departureDate', value)
                    }
                  />

                  {segments.length > 2 && (
                    <button
                      className="availability-remove-segment"
                      type="button"
                      onClick={() => handleRemoveSegment(segment.id)}
                      aria-label={`Remove segment ${index + 1}`}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              ))}

              <button
                className="availability-add-segment"
                type="button"
                onClick={handleAddSegment}
              >
                <Plus size={16} /> Add flight segment
              </button>
            </div>
          ) : (
            <div
              className={`availability-main-row${
                tripType === 'Round Trip' ? ' has-return' : ''
              }`}
            >
              <LocationField
                label="Enter Origin"
                value={primarySegment.fromCity}
                onChange={(value) =>
                  updateSegment(primarySegment.id, 'fromCity', value)
                }
                options={locations}
                loading={optionsLoading}
                icon={PlaneTakeoff}
                listId="locations-primary-origin"
              />

              <button
                className="availability-swap"
                type="button"
                onClick={() => handleSwap()}
                aria-label="Swap origin and destination"
                title="Swap origin and destination"
              >
                <ArrowLeftRight size={18} />
              </button>

              <LocationField
                label="Enter Destination"
                value={primarySegment.toCity}
                onChange={(value) =>
                  updateSegment(primarySegment.id, 'toCity', value)
                }
                options={locations}
                loading={optionsLoading}
                icon={PlaneLanding}
                listId="locations-primary-destination"
              />

              <DateField
                label="Departure Date"
                value={primarySegment.departureDate}
                min={today}
                onChange={(value) =>
                  updateSegment(
                    primarySegment.id,
                    'departureDate',
                    value
                  )
                }
              />

              {tripType === 'Round Trip' && (
                <DateField
                  label="Return Date"
                  value={returnDate}
                  min={primarySegment.departureDate || today}
                  onChange={(value) => {
                    setReturnDate(value);
                    setHasSearched(false);
                  }}
                />
              )}

              <div className="availability-passengers">
                <div className="availability-label">Passengers</div>

                <div className="availability-passenger-counts">
                  <CountField
                    label="Adults"
                    hint="12+ years"
                    value={adults}
                    min={1}
                    onChange={setAdults}
                  />

                  <CountField
                    label="Children"
                    hint="2–12 years"
                    value={children}
                    onChange={setChildren}
                  />

                  <CountField
                    label="Infants"
                    hint="Under 2"
                    value={infants}
                    onChange={setInfants}
                  />
                </div>
              </div>
            </div>
          )}

          {isMultiCity && (
            <div className="availability-passengers availability-multicity-passengers">
              <div className="availability-label">Passengers</div>

              <div className="availability-passenger-counts">
                <CountField
                  label="Adults"
                  hint="12+ years"
                  value={adults}
                  min={1}
                  onChange={setAdults}
                />

                <CountField
                  label="Children"
                  hint="2–12 years"
                  value={children}
                  onChange={setChildren}
                />

                <CountField
                  label="Infants"
                  hint="Under 2"
                  value={infants}
                  onChange={setInfants}
                />
              </div>
            </div>
          )}

          <div className="availability-additional">
            <label className="availability-field">
              <span className="availability-label">Travellers</span>

              <div className="travellers-field" ref={dropdownRef}>
                <button
                  type="button"
                  id="travellers-input"
                  className="travellers-input"
                  onClick={openDropdown}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="dialog"
                >
                  <span>{selectedCabin}</span>

                  <span className="dropdown-arrow">
                    {dropdownOpen ? '▲' : '▼'}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="travellers-dropdown" role="dialog">
                    <h4>Select Class</h4>

                    <div className="cabin-options">
                      {CABIN_CLASSES.map((cabin) => (
                        <label
                          key={cabin}
                          className={`cabin-option ${
                            selectedCabin === cabin ? 'selected' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="cabinClass"
                            value={cabin}
                            checked={selectedCabin === cabin}
                            onChange={() => {
                              // Change the selection only.
                              // Fare remains based on searchedCabin.
                              setSelectedCabin(cabin);
                              setDropdownOpen(false);
                            }}
                          />

                          <span>{cabin}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </label>

            <label className="availability-field">
              <span className="availability-label">Airline</span>

              <span className="availability-input-wrap">
                <Plane
                  className="availability-input-icon"
                  size={17}
                  aria-hidden="true"
                />

                <select
                  value={airline}
                  onChange={(event) => setAirline(event.target.value)}
                >
                  <option value="">All airlines</option>

                  {airlines.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  className="availability-select-chevron"
                  size={15}
                  aria-hidden="true"
                />
              </span>
            </label>
          </div>

          <div className="availability-form-actions">
            <button
              className="availability-submit"
              type="submit"
              disabled={loading || optionsLoading}
            >
              <Search size={18} />
              {loading ? 'Searching flights…' : 'Search Flight'}
            </button>
          </div>
        </form>
      </section>

      {hasSearched && !error && (
        <section className="availability-results" aria-live="polite">
          {tripType === 'Round Trip' && (
            <p className="availability-note">
              Outbound and return options are searched separately. The
              current booking flow books each ticket individually.
            </p>
          )}


          {loading && (
            <div className="availability-empty-state">
              <Search size={26} />
              <p>Searching scheduled flights…</p>
            </div>
          )}

          {!loading &&
            resultSections.map((section) => (
              <section
                className="availability-result-section"
                key={section.id}
              >
                <h3>
                  {section.title}{' '}
                  <span>({section.flights.length})</span>
                </h3>

                {section.flights.length > 0 ? (
                  <div className="availability-flight-list">
                    {sortFlights(section.flights, sortBy).map((flight) => (
                      <FlightCard
                        key={flight.flightId}
                        flight={flight}
                        couponCode={location.state?.couponCode}
                        selectedCabin={searchedCabin}
                        passengerCount={totalPassengers}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="availability-empty-state">
                    <Search size={26} />
                    <p>
                      No matching scheduled flights are available for this
                      route and date.
                    </p>
                  </div>
                )}
              </section>
            ))}
        </section>
      )}
    </div>
  );
}

