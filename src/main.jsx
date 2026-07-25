import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import './styles.css'

const ordreCategories = [
  'Gui Gui',
  'K-Pop Demon Hunters',
  'LEGO',
  'Playmobil',
  'Barbie',
  'Toy Story',
  'Activités créatives',
  'Jeux de société',
]

const formaterPrix = (prix) => {
  if (prix === null || prix === undefined || prix === '') return ''

  const montant = Number(String(prix).replace(',', '.'))

  if (Number.isNaN(montant)) return String(prix)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(montant)
}

function App() {
  const [cadeaux, setCadeaux] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [reservation, setReservation] = useState(null)
  const [prenom, setPrenom] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [categorieActive, setCategorieActive] = useState('Toutes')
  const [uniquementCoupsDeCoeur, setUniquementCoupsDeCoeur] = useState(false)

  async function charger() {
    setErreur('')

    const { data, error } = await supabase
      .from('cadeaux')
      .select('*')
      .order('ordre', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    if (error) {
      setErreur(
        'Impossible de charger les cadeaux. Vérifiez la configuration Supabase.'
      )
    } else {
      setCadeaux(data ?? [])
    }

    setChargement(false)
  }

  useEffect(() => {
    charger()

    const canal = supabase
      .channel('cadeaux-en-direct')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cadeaux',
        },
        () => charger()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [])

  const categoriesDisponibles = useMemo(() => {
    const categories = [
      ...new Set(
        cadeaux
          .map((cadeau) => cadeau.categorie || 'Autres idées')
          .filter(Boolean)
      ),
    ]

    return categories.sort((a, b) => {
      const ia = ordreCategories.indexOf(a)
      const ib = ordreCategories.indexOf(b)

      if (ia === -1 && ib === -1) return a.localeCompare(b, 'fr')
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [cadeaux])

  const cadeauxFiltres = useMemo(() => {
    const texte = recherche.trim().toLocaleLowerCase('fr-FR')

    return cadeaux.filter((cadeau) => {
      const categorie = cadeau.categorie || 'Autres idées'
      const correspondRecherche =
        !texte ||
        cadeau.nom?.toLocaleLowerCase('fr-FR').includes(texte)

      const correspondCategorie =
        categorieActive === 'Toutes' || categorie === categorieActive

      const correspondCoupDeCoeur =
        !uniquementCoupsDeCoeur || cadeau.coup_de_coeur === true

      return (
        correspondRecherche &&
        correspondCategorie &&
        correspondCoupDeCoeur
      )
    })
  }, [cadeaux, recherche, categorieActive, uniquementCoupsDeCoeur])

  const groupes = useMemo(() => {
    const map = new Map()

    for (const cadeau of cadeauxFiltres) {
      const categorie = cadeau.categorie || 'Autres idées'

      if (!map.has(categorie)) {
        map.set(categorie, [])
      }

      map.get(categorie).push(cadeau)
    }

    for (const items of map.values()) {
      items.sort((a, b) => {
        if (a.coup_de_coeur !== b.coup_de_coeur) {
          return a.coup_de_coeur ? -1 : 1
        }

        const ordreA = a.ordre ?? Number.MAX_SAFE_INTEGER
        const ordreB = b.ordre ?? Number.MAX_SAFE_INTEGER

        if (ordreA !== ordreB) return ordreA - ordreB
        return a.id - b.id
      })
    }

    return [...map.entries()].sort(([a], [b]) => {
      const ia = ordreCategories.indexOf(a)
      const ib = ordreCategories.indexOf(b)

      if (ia === -1 && ib === -1) return a.localeCompare(b, 'fr')
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
  }, [cadeauxFiltres])

  async function confirmer(e) {
    e.preventDefault()

    const nom = prenom.trim()

    if (!nom || !reservation) return

    setEnvoi(true)
    setErreur('')

    const { data, error } = await supabase.rpc('reserver_cadeau', {
      cadeau_id: reservation.id,
      prenom_reservant: nom,
    })

    if (error) {
      setErreur("La réservation n'a pas pu être enregistrée.")
    } else if (data === false) {
      setErreur("Ce cadeau vient d'être réservé par quelqu'un d'autre.")
    } else {
      setReservation(null)
      setPrenom('')
      await charger()
    }

    setEnvoi(false)
  }

  const reinitialiserFiltres = () => {
    setRecherche('')
    setCategorieActive('Toutes')
    setUniquementCoupsDeCoeur(false)
  }

  return (
    <>
      <header className="hero">
        <div className="sparkle">✨</div>
        <p className="surtitle">7 ans & Noël 2026</p>
        <h1>Les envies de Lyna</h1>
        <p className="intro">
          Voici quelques idées qui feraient plaisir à Lyna. Pour éviter les
          doublons, réservez simplement le cadeau choisi.
        </p>
      </header>

      <main className="container">
        <section
          aria-label="Recherche et filtres"
          style={{ margin: '24px auto 32px', display: 'grid', gap: '14px' }}
        >
          <input
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher un cadeau…"
            aria-label="Rechercher un cadeau par son nom"
            style={{
              width: '100%',
              padding: '14px 18px',
              border: '1px solid #ddd',
              borderRadius: '999px',
              font: 'inherit',
              fontSize: '16px',
              background: '#fff',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
            }}
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className={
                uniquementCoupsDeCoeur
                  ? 'bouton principal'
                  : 'bouton secondaire'
              }
              onClick={() =>
                setUniquementCoupsDeCoeur((valeur) => !valeur)
              }
            >
              ⭐ Coups de cœur
            </button>

            <select
              value={categorieActive}
              onChange={(event) => setCategorieActive(event.target.value)}
              aria-label="Filtrer par catégorie"
              style={{
                padding: '11px 14px',
                border: '1px solid #ddd',
                borderRadius: '999px',
                font: 'inherit',
                background: '#fff',
              }}
            >
              <option value="Toutes">Toutes les catégories</option>
              {categoriesDisponibles.map((categorie) => (
                <option key={categorie} value={categorie}>
                  {categorie}
                </option>
              ))}
            </select>

            {(recherche ||
              categorieActive !== 'Toutes' ||
              uniquementCoupsDeCoeur) && (
              <button
                type="button"
                className="bouton secondaire"
                onClick={reinitialiserFiltres}
              >
                Réinitialiser
              </button>
            )}
          </div>

          {!chargement && cadeauxFiltres.length > 0 && (
            <p style={{ margin: 0, opacity: 0.75 }}>
              {cadeauxFiltres.length}{' '}
              {cadeauxFiltres.length > 1 ? 'cadeaux affichés' : 'cadeau affiché'}
            </p>
          )}
        </section>

        {chargement && <p className="message">Chargement de la liste…</p>}

        {erreur && <p className="message erreur">{erreur}</p>}

        {!chargement && cadeaux.length === 0 && (
          <p className="message">
            La liste est prête : il ne reste plus qu'à ajouter les cadeaux
            dans Supabase.
          </p>
        )}

        {!chargement && cadeaux.length > 0 && cadeauxFiltres.length === 0 && (
          <p className="message">
            Aucun cadeau ne correspond à votre recherche.
          </p>
        )}

        {groupes.map(([categorie, items]) => (
          <section key={categorie} className="categorie">
            <h2>{categorie}</h2>

            <div className="grille">
              {items.map((cadeau) => (
                <article
                  key={cadeau.id}
                  className={`carte ${cadeau.reserve ? 'reservee' : ''}`}
                >
                  <div className="visuel">
                    {cadeau.image ? (
                      <img src={cadeau.image} alt={cadeau.nom} loading="lazy" />
                    ) : (
                      <div className="sans-image">🎁</div>
                    )}

                    {cadeau.coup_de_coeur && (
                      <span className="coeur">⭐ Coup de cœur</span>
                    )}

                    {cadeau.reserve && (
                      <span className="badge-reserve">Déjà réservé</span>
                    )}
                  </div>

                  <div className="contenu">
                    <h3>{cadeau.nom}</h3>

                    {cadeau.prix && (
                      <p className="prix">{formaterPrix(cadeau.prix)}</p>
                    )}

                    <div className="actions">
                      {cadeau.lien && (
                        <a
                          href={cadeau.lien}
                          target="_blank"
                          rel="noreferrer"
                          className="bouton secondaire"
                        >
                          Voir le cadeau
                        </a>
                      )}

                      {!cadeau.reserve && (
                        <button
                          className="bouton principal"
                          onClick={() => setReservation(cadeau)}
                        >
                          Réserver
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>

      <footer>Liste préparée avec amour pour Lyna 💜</footer>

      {reservation && (
        <div className="fond-modal" onMouseDown={() => setReservation(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="fermer" onClick={() => setReservation(null)}>
              ×
            </button>

            <h2>Réserver ce cadeau</h2>
            <p>
              <strong>{reservation.nom}</strong>
            </p>

            <p className="petit">
              Votre prénom sert uniquement à Élodie pour suivre les
              réservations. Il n'est pas affiché aux autres visiteurs.
            </p>

            <form onSubmit={confirmer}>
              <label htmlFor="prenom">Votre prénom</label>

              <input
                id="prenom"
                value={prenom}
                onChange={(event) => setPrenom(event.target.value)}
                maxLength={60}
                autoFocus
                required
              />

              <button className="bouton principal pleine" disabled={envoi}>
                {envoi ? 'Réservation…' : 'Confirmer la réservation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
