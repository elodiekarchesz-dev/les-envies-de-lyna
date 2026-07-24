import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import './styles.css'

const ordreCategories=['Gui Gui','K-Pop Demon Hunters','LEGO','Playmobil','Barbie','Toy Story','Activités créatives','Jeux de société']

function App(){
 const [cadeaux,setCadeaux]=useState([]),[chargement,setChargement]=useState(true),[erreur,setErreur]=useState(''),[reservation,setReservation]=useState(null),[prenom,setPrenom]=useState(''),[envoi,setEnvoi]=useState(false)
 async function charger(){
  setErreur('')
  const {data,error}=await supabase.from('cadeaux').select('*').order('ordre',{ascending:true,nullsFirst:false}).order('id',{ascending:true})
  if(error)setErreur("Impossible de charger les cadeaux. Vérifiez la configuration Supabase."); else setCadeaux(data??[])
  setChargement(false)
 }
 useEffect(()=>{charger();const canal=supabase.channel('cadeaux-en-direct').on('postgres_changes',{event:'UPDATE',schema:'public',table:'cadeaux'},()=>charger()).subscribe();return()=>{supabase.removeChannel(canal)}},[])
 const groupes=useMemo(()=>{const map=new Map();for(const c of cadeaux){const cat=c.categorie||'Autres idées';if(!map.has(cat))map.set(cat,[]);map.get(cat).push(c)}return[...map.entries()].sort(([a],[b])=>{const ia=ordreCategories.indexOf(a),ib=ordreCategories.indexOf(b);if(ia===-1&&ib===-1)return a.localeCompare(b,'fr');if(ia===-1)return 1;if(ib===-1)return-1;return ia-ib})},[cadeaux])
 async function confirmer(e){e.preventDefault();const nom=prenom.trim();if(!nom||!reservation)return;setEnvoi(true);setErreur('');const {data,error}=await supabase.rpc('reserver_cadeau',{cadeau_id:reservation.id,prenom_reservant:nom});if(error)setErreur("La réservation n'a pas pu être enregistrée.");else if(data===false)setErreur("Ce cadeau vient d'être réservé par quelqu'un d'autre.");else{setReservation(null);setPrenom('');await charger()}setEnvoi(false)}
 return <>
  <header className="hero"><div className="sparkle">✨</div><p className="surtitle">7 ans & Noël 2026</p><h1>Les envies de Lyna</h1><p className="intro">Voici quelques idées qui feraient plaisir à Lyna. Pour éviter les doublons, réservez simplement le cadeau choisi.</p></header>
  <main className="container">
   {chargement&&<p className="message">Chargement de la liste…</p>}
   {erreur&&<p className="message erreur">{erreur}</p>}
   {!chargement&&cadeaux.length===0&&<p className="message">La liste est prête : il ne reste plus qu'à ajouter les cadeaux dans Supabase.</p>}
   {groupes.map(([categorie,items])=><section key={categorie} className="categorie"><h2>{categorie}</h2><div className="grille">{items.map(c=><article key={c.id} className={`carte ${c.reserve?'reservee':''}`}><div className="visuel">{c.image?<img src={c.image} alt={c.nom} loading="lazy"/>:<div className="sans-image">🎁</div>}{c.coup_de_coeur&&<span className="coeur">⭐ Coup de cœur</span>}{c.reserve&&<span className="badge-reserve">Déjà réservé</span>}</div><div className="contenu"><h3>{c.nom}</h3>{c.prix&&<p className="prix">{c.prix}</p>}<div className="actions">{c.lien&&<a href={c.lien} target="_blank" rel="noreferrer" className="bouton secondaire">Voir le cadeau</a>}{!c.reserve&&<button className="bouton principal" onClick={()=>setReservation(c)}>Réserver</button>}</div></div></article>)}</div></section>)}
  </main>
  <footer>Liste préparée avec amour pour Lyna 💜</footer>
  {reservation&&<div className="fond-modal" onMouseDown={()=>setReservation(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={e=>e.stopPropagation()}><button className="fermer" onClick={()=>setReservation(null)}>×</button><h2>Réserver ce cadeau</h2><p><strong>{reservation.nom}</strong></p><p className="petit">Votre prénom sert uniquement à Élodie pour suivre les réservations. Il n'est pas affiché aux autres visiteurs.</p><form onSubmit={confirmer}><label htmlFor="prenom">Votre prénom</label><input id="prenom" value={prenom} onChange={e=>setPrenom(e.target.value)} maxLength={60} autoFocus required/><button className="bouton principal pleine" disabled={envoi}>{envoi?'Réservation…':'Confirmer la réservation'}</button></form></div></div>}
 </>
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
