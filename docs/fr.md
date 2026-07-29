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
- **Octets envoyés** / **Octets reçus** — compteurs de trafic total ;
- **Paquets envoyés** / **Paquets reçus** — compteurs de paquets total.

## Remarques

- Les compteurs d'octets et de paquets proviennent directement du service IGD de
  la box. Sur beaucoup de box, ces compteurs sont **codés sur 32 bits et
  reviennent à zéro vers ~4 Go** — la valeur brute est remontée telle quelle,
  attendez-vous donc à voir le graphe se réinitialiser régulièrement sur ces
  box.
- Rien n'est pilotable : une box n'expose que des statistiques via IGD, toutes
  les fonctionnalités sont donc en lecture seule.
- L'UPnP/IGD doit être **activé** sur votre box (c'est généralement le cas par
  défaut).
