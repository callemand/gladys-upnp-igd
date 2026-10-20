# UPnP / IGD

## Présentation

Cette intégration connecte Gladys Assistant à votre **box internet / routeur**
via le protocole **UPnP-IGD** (Internet Gateway Device) exposé par presque
toutes les box domestiques sur le réseau local. Elle transforme votre box en un
appareil Gladys dont les fonctionnalités, en lecture seule, permettent de
grapher le trafic, de suivre l'état de la ligne et de déclencher des scènes sur
l'état du lien WAN (par exemple être prévenu quand la connexion tombe).

## Découverte

L'intégration trouve votre box automatiquement grâce à un scan réseau **SSDP**
lancé par le cœur de Gladys. Ouvrez l'écran **Découverte** de Gladys : votre box
apparaît — ajoutez-la, et elle commence à remonter ses informations.

Si la découverte automatique ne trouve rien (certaines box désactivent l'UPnP,
ou le scan ne peut pas les atteindre), renseignez le paramètre optionnel **URL
de description de la box** avec l'URL de description UPnP de votre box (du type
`http://192.168.1.1:5000/rootDesc.xml`) puis relancez la Découverte.

## Fonctionnalités

Chaque box expose ces fonctionnalités en lecture seule :

- **État de la connexion** — le lien WAN est actif ou non ;
- **IP externe** — votre adresse IP publique ;
- **Durée de connexion** — depuis combien de temps la connexion est active
  (secondes) ;
- **Débit descendant** / **Débit montant** : le débit moyen (Mbit/s) depuis la
  lecture précédente, mis à jour toutes les 15 secondes ;
- **Paquets envoyés** / **Paquets reçus** — compteurs de paquets total.

## Remarques

- Les débits sont calculés à partir des compteurs d'octets de la box. Ces
  compteurs sont **codés sur 32 bits** : la plupart des box les remettent à
  zéro vers ~4,29 Go, et l'intégration en tient compte. Certaines box (par
  exemple la Livebox d'Orange) les bloquent au maximum. Sur ces box, aucun débit
  ne peut être calculé.
- Le premier débit apparaît à la deuxième lecture, environ 15 secondes après le
  démarrage.
- Les compteurs de paquets viennent directement de la box. Ils sont aussi sur
  32 bits : attendez-vous à voir le graphe repartir de zéro régulièrement.
- Rien n'est pilotable : une box n'expose que des statistiques via IGD, toutes
  les fonctionnalités sont donc en lecture seule.
- L'UPnP/IGD doit être **activé** sur votre box (c'est généralement le cas par
  défaut).
