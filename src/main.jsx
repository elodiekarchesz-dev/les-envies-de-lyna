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

const colonnesPubliques = [
  'id',
  'nom',
  'categorie',
  'image',
  'lien',
  'prix',
  'ordre',
  'coup_de_coeur',
  'reserve',
].join(',')

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
  const [pageAdmin, setPageAdmin] = useState(
    window.location.hash === '#admin'
  )

  useEffect(() => {
    const actualiserPage = () =>
      setPageAdmin(window.location.hash === '#admin')

    window.addEventListener('hashchange', actualiserPage)
    return () => window.removeEventListener('hashchange', actualiserPage)
  }, [])

  return pageAdmin ? <PageAdmin /> : <ListeCadeaux />
}

function ListeCadeaux() {
  const [cadeaux, setCadeaux] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [reservation, setReservation] = useState(null)
  const [prenom, setPrenom] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [categorieActive, setCategorieActive] = useState('Toutes')
  const [uniquementCoupsDeCoeur, setUniquementCoupsDeCoeur] =
    useState(false)

  async function charger() {
    setErreur('')

    const { data, error } = await supabase
      .from('cadeaux')
      .select(colonnesPubliques)
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

  const statistiques = useMemo(() => {
    const total = cadeaux.length
    const reserves = cadeaux.filter((cadeau) => cadeau.reserve).length

    return {
      total,
      reserves,
      disponibles: total - reserves,
    }
  }, [cadeaux])

  const categoriesDisponibles = useMemo(() => {
    const categories = [
      ...new Set(
        cadeaux.map((cadeau) => cadeau.categorie || 'Autres idées')
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
      if (!map.has(categorie)) map.set(categorie, [])
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

  async function confirmer(event) {
    event.preventDefault()

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
        {!chargement && cadeaux.length > 0 && (
          <section className="compteur" aria-label="État des réservations">
            <div>
              <strong>{statistiques.total}</strong>
              <span>cadeaux</span>
            </div>
            <div>
              <strong>{statistiques.reserves}</strong>
              <span>déjà réservés</span>
            </div>
            <div>
              <strong>{statistiques.disponibles}</strong>
              <span>encore disponibles</span>
            </div>
          </section>
        )}

        {!chargement && cadeaux.length > 0 && (
          <p className="resume-compteur">
            🎁 {statistiques.reserves} cadeau
            {statistiques.reserves > 1 ? 'x' : ''} réservé
            {statistiques.reserves > 1 ? 's' : ''} sur {statistiques.total}
            {' '}— {statistiques.disponibles} encore disponible
            {statistiques.disponibles > 1 ? 's' : ''}
          </p>
        )}

        <section className="outils" aria-label="Recherche et filtres">
          <input
            className="recherche"
            type="search"
            value={recherche}
            onChange={(event) => setRecherche(event.target.value)}
            placeholder="Rechercher un cadeau…"
            aria-label="Rechercher un cadeau par son nom"
          />

          <div className="filtres">
            <button
              type="button"
              className={`bouton ${
                uniquementCoupsDeCoeur ? 'principal' : 'secondaire'
              }`}
              onClick={() =>
                setUniquementCoupsDeCoeur((valeur) => !valeur)
              }
            >
              💜 Coups de cœur
            </button>

            <select
              value={categorieActive}
              onChange={(event) => setCategorieActive(event.target.value)}
              aria-label="Filtrer par catégorie"
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
            <p className="resultats">
              {cadeauxFiltres.length}{' '}
              {cadeauxFiltres.length > 1
                ? 'cadeaux affichés'
                : 'cadeau affiché'}
            </p>
          )}
        </section>

        {chargement && (
          <p className="message">Chargement de la liste…</p>
        )}

        {erreur && <p className="message erreur">{erreur}</p>}

        {!chargement && cadeaux.length === 0 && (
          <p className="message">
            La liste est prête : il ne reste plus qu'à ajouter les cadeaux
            dans Supabase.
          </p>
        )}

        {!chargement &&
          cadeaux.length > 0 &&
          cadeauxFiltres.length === 0 && (
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
                      <img
                        src={cadeau.image}
                        alt={cadeau.nom}
                        loading="lazy"
                      />
                    ) : (
                      <div className="sans-image">🎁</div>
                    )}

                    {cadeau.coup_de_coeur && (
                      <span className="coeur">
                        💜 Coup de cœur de Lyna
                      </span>
                    )}

                    {cadeau.reserve && (
                      <span className="badge-reserve">Déjà réservé</span>
                    )}
                  </div>

                  <div className="contenu">
                    <h3>{cadeau.nom}</h3>

                    {cadeau.prix && (
                      <p className="prix">
                        {formaterPrix(cadeau.prix)}
                      </p>
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

      <footer>
        <p>Liste préparée avec amour pour Lyna 💜</p>
        <a className="lien-admin" href="#admin">
          Espace privé
        </a>
      </footer>

      {reservation && (
        <div
          className="fond-modal"
          onMouseDown={() => setReservation(null)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="fermer"
              onClick={() => setReservation(null)}
              aria-label="Fermer"
            >
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

              <button
                className="bouton principal pleine"
                disabled={envoi}
              >
                {envoi
                  ? 'Réservation…'
                  : 'Confirmer la réservation'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function PageAdmin() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [reservations, setReservations] = useState([])
  const [chargement, setChargement] = useState(true)
  const [connexion, setConnexion] = useState(false)
  const [erreur, setErreur] = useState('')
  const [rechercheAdmin, setRechercheAdmin] = useState('')

  async function chargerReservations() {
    setChargement(true)
    setErreur('')

    const { data, error } = await supabase.rpc(
      'admin_liste_reservations'
    )

    if (error) {
      setErreur(
        "Impossible d'afficher les réservations. Vérifiez le SQL Supabase et le compte administrateur."
      )
      setReservations([])
    } else {
      setReservations(data ?? [])
    }

    setChargement(false)
  }

  useEffect(() => {
    let actif = true

    supabase.auth.getSession().then(({ data }) => {
      if (!actif) return
      setSession(data.session)

      if (data.session) {
        chargerReservations()
      } else {
        setChargement(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nouvelleSession) => {
      setSession(nouvelleSession)

      if (nouvelleSession) {
        chargerReservations()
      } else {
        setReservations([])
        setChargement(false)
      }
    })

    return () => {
      actif = false
      subscription.unsubscribe()
    }
  }, [])

  async function seConnecter(event) {
    event.preventDefault()
    setConnexion(true)
    setErreur('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    })

    if (error) {
      setErreur('Adresse e-mail ou mot de passe incorrect.')
    }

    setConnexion(false)
  }

  async function seDeconnecter() {
    await supabase.auth.signOut()
  }

  const reservationsEffectives = reservations.filter(
    (cadeau) => cadeau.reserve
  )

  const reservationsFiltrees = reservationsEffectives.filter((cadeau) => {
    const texte = rechercheAdmin.trim().toLocaleLowerCase('fr-FR')

    if (!texte) return true

    return (
      cadeau.nom?.toLocaleLowerCase('fr-FR').includes(texte) ||
      cadeau.categorie?.toLocaleLowerCase('fr-FR').includes(texte) ||
      cadeau.prenom_reservant?.toLocaleLowerCase('fr-FR').includes(texte)
    )
  })

  function exporterReservations() {
    const lignes = [
      ['Cadeau', 'Catégorie', 'Réservé par'],
      ...reservationsEffectives.map((cadeau) => [
        cadeau.nom ?? '',
        cadeau.categorie ?? '',
        cadeau.prenom_reservant ?? '',
      ]),
    ]

    const csv = lignes
      .map((ligne) =>
        ligne
          .map((cellule) => `"${String(cellule).replaceAll('"', '""')}"`)
          .join(';')
      )
      .join('\n')

    const fichier = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(fichier)
    const lien = document.createElement('a')

    lien.href = url
    lien.download = 'reservations-lyna.csv'
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
  }

  if (!session) {
    return (
      <main className="admin-page">
        <section className="admin-carte connexion-admin">
          <a className="retour-site" href="#">
            ← Retour à la liste
          </a>

          <div className="admin-icone">🔐</div>
          <h1>Espace privé</h1>
          <p>
            Connectez-vous pour voir qui a réservé les cadeaux.
          </p>

          {erreur && <p className="message erreur">{erreur}</p>}

          <form onSubmit={seConnecter}>
            <label htmlFor="email-admin">Adresse e-mail</label>
            <input
              id="email-admin"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="mot-de-passe-admin">Mot de passe</label>
            <input
              id="mot-de-passe-admin"
              type="password"
              value={motDePasse}
              onChange={(event) => setMotDePasse(event.target.value)}
              autoComplete="current-password"
              required
            />

            <button
              className="bouton principal pleine"
              disabled={connexion}
            >
              {connexion ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <section className="admin-carte">
        <div className="admin-entete">
          <div>
            <a className="retour-site" href="#">
              ← Retour à la liste
            </a>
            <h1>Réservations</h1>
            <p>
              {reservationsEffectives.length}{' '}
              {reservationsEffectives.length > 1
                ? 'cadeaux réservés'
                : 'cadeau réservé'}
            </p>
          </div>

          <button
            type="button"
            className="bouton secondaire"
            onClick={seDeconnecter}
          >
            Se déconnecter
          </button>
        </div>

        {!chargement && !erreur && (
          <>
            <section className="stats-admin" aria-label="Résumé des cadeaux">
              <div>
                <strong>{reservations.length}</strong>
                <span>cadeaux au total</span>
              </div>
              <div>
                <strong>{reservationsEffectives.length}</strong>
                <span>réservés</span>
              </div>
              <div>
                <strong>
                  {Math.max(
                    reservations.length - reservationsEffectives.length,
                    0
                  )}
                </strong>
                <span>disponibles</span>
              </div>
            </section>

            <section className="outils-admin">
              <input
                type="search"
                value={rechercheAdmin}
                onChange={(event) =>
                  setRechercheAdmin(event.target.value)
                }
                placeholder="Rechercher un cadeau ou un prénom…"
                aria-label="Rechercher dans les réservations"
              />

              <button
                type="button"
                className="bouton secondaire"
                onClick={exporterReservations}
                disabled={reservationsEffectives.length === 0}
              >
                Télécharger pour Excel
              </button>
            </section>
          </>
        )}

        {chargement && (
          <p className="message">Chargement des réservations…</p>
        )}

        {erreur && <p className="message erreur">{erreur}</p>}

        {!chargement &&
          !erreur &&
          reservationsEffectives.length === 0 && (
            <p className="message">
              Aucun cadeau n'est encore réservé.
            </p>
          )}

        {!chargement &&
          !erreur &&
          reservationsEffectives.length > 0 &&
          reservationsFiltrees.length === 0 && (
            <p className="message">
              Aucun résultat ne correspond à cette recherche.
            </p>
          )}

        {!chargement && !erreur && reservationsFiltrees.length > 0 && (
          <div className="liste-admin">
            {reservationsFiltrees.map((cadeau) => (
              <article className="reservation-admin" key={cadeau.id}>
                <div>
                  <span className="categorie-admin">
                    {cadeau.categorie || 'Autres idées'}
                  </span>
                  <h2>{cadeau.nom}</h2>
                </div>

                <p>
                  Réservé par{' '}
                  <strong>{cadeau.prenom_reservant || 'Non renseigné'}</strong>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
