/* Decks dos personagens do anime: 60 cartas cada, com as cópias, montados com as cartas que mais combinam com cada um
   (os Pokémon do personagem, as cartas oficiais "de treinador" — Misty's, Brock's, Team Rocket's, Cynthia's — e o
   apoiador com o nome dele quando existe). Linha = "quantidade Nome em inglês" (como no catálogo da TCGdex).
   "*" no começo = carta de capa (as 3 que aparecem no leque). Opcional "@coleção" no fim escolhe a impressão.
   O script scripts/gerar-personagens.mjs confere os nomes, escolhe a melhor versão de cada carta e grava
   public/data/decks-personagens.json. Regras: somar 60 e no máximo 4 cópias com o mesmo nome (Energia Básica livre). */
export const PERSONAGENS = [
  {
    nome: "Deck do Ash", retrato: "ash", era: "Kanto a Paldea",
    desc: "Pikachu na frente, com os parceiros mais marcantes do Ash: Charizard, Bulbasaur, Squirtle, Pidgeot e o Greninja de Kalos.",
    cartas: `
*4 Pikachu
2 Raichu
*1 Ash's Pikachu
2 Charmander
1 Charmeleon
*1 Charizard
2 Bulbasaur
2 Squirtle
2 Froakie
1 Frogadier
1 Greninja
1 Ash Greninja EX
1 Pidgey
1 Pidgeot
4 Professor's Research
4 Poké Ball
2 Rare Candy
3 Potion
2 Switch
2 Nest Ball
2 Ultra Ball
2 Energy Retrieval
1 Pokégear 3.0
9 Lightning Energy
3 Fire Energy
2 Water Energy
2 Grass Energy`,
  },
  {
    nome: "Deck da Misty", retrato: "misty", era: "Kanto",
    desc: "A líder do Ginásio de Celeste: Starmie, Psyduck, Gyarados e Togepi, com as cartas oficiais da Misty e o Ginásio de Celeste.",
    cartas: `
*4 Misty's Staryu
*3 Misty's Starmie
*2 Misty's Psyduck
1 Misty's Golduck
2 Misty's Horsea
1 Misty's Seadra
3 Misty's Magikarp
2 Misty's Gyarados
1 Misty's Lapras
2 Togepi
1 Togetic
1 Togekiss
4 Misty's Determination
2 Misty's Favor
2 Professor's Research
4 Nest Ball
2 Rare Candy
2 Super Rod
2 Energy Retrieval
1 Misty's Cerulean City Gym
2 Ultra Ball
2 Switch
14 Water Energy`,
  },
  {
    nome: "Deck do Brock", retrato: "brock", era: "Kanto",
    desc: "O líder do Ginásio de Pewter e seus Pokémon de pedra: Onix, Geodude, Rhyhorn e o Vulpix que ele criou com carinho.",
    cartas: `
*3 Brock's Onix
4 Brock's Geodude
2 Brock's Graveler
*2 Brock's Golem
2 Brock's Rhyhorn
1 Brock's Rhydon
2 Brock's Zubat
1 Brock's Golbat
*2 Brock's Vulpix
1 Brock's Ninetales
1 Steelix
1 Sudowoodo
3 Brock's Grit
2 Brock's Training
2 Brock's Pewter City Gym
3 Professor's Research
2 Rare Candy
3 Nest Ball
2 Potion
2 Switch
2 Energy Retrieval
2 Ultra Ball
12 Fighting Energy
3 Fire Energy`,
  },
  {
    nome: "Deck do Gary", retrato: "gary", era: "Kanto e Johto",
    desc: "O eterno rival do Ash: Blastoise, Umbreon, Nidoking, Arcanine, Electivire e Scizor, com a pesquisa do avô, o Professor Carvalho.",
    cartas: `
3 Squirtle
2 Wartortle
*2 Blastoise
3 Eevee
*2 Umbreon
2 Nidoran ♂
1 Nidorino
1 Nidoking
2 Growlithe
*1 Arcanine
2 Electabuzz
1 Electivire
1 Scyther
1 Scizor
4 Professor's Research
2 Blue's Tactics
3 Rare Candy
3 Ultra Ball
2 Nest Ball
2 Switch
2 Boss's Orders
1 Super Rod
7 Water Energy
4 Darkness Energy
3 Lightning Energy
3 Fire Energy`,
  },
  {
    nome: "Deck da Equipe Rocket", retrato: "equipe-rocket", era: "Kanto a Paldea",
    desc: "Jessie, James e Meowth: Arbok, Weezing, Wobbuffet e as cartas oficiais da Equipe Rocket, com o Mewtwo ex como trunfo.",
    cartas: `
*2 Team Rocket's Meowth
1 Team Rocket's Persian ex
3 Team Rocket's Ekans
*2 Team Rocket's Arbok
3 Team Rocket's Koffing
*2 Team Rocket's Weezing
2 Team Rocket's Wobbuffet
1 Team Rocket's Mimikyu
1 Team Rocket's Mewtwo ex
2 Team Rocket's Zubat
1 Team Rocket's Golbat
1 Team Rocket's Crobat ex
4 Jessie & James
2 Team Rocket's Ariana
2 Team Rocket's Petrel
4 Team Rocket's Great Ball
2 Team Rocket's Factory
2 Team Rocket's Bother-Bot
2 Team Rocket's Transceiver
2 Rare Candy
2 Night Stretcher
4 Team Rocket's Energy
8 Darkness Energy
5 Psychic Energy`,
  },
  {
    nome: "Deck da Dawn", retrato: "dawn", era: "Sinnoh",
    desc: "A coordenadora de Sinnoh: Piplup até Empoleon, Buneary, Pachirisu, Ambipom e Mamoswine, com o apoiador Dawn.",
    cartas: `
*4 Piplup
2 Prinplup
*2 Empoleon
*2 Buneary
1 Lopunny
2 Pachirisu
2 Aipom
1 Ambipom
2 Swinub
1 Piloswine
1 Mamoswine
3 Dawn
3 Professor's Research
3 Rare Candy
3 Nest Ball
2 Ultra Ball
2 Switch
2 Super Rod
2 Energy Retrieval
2 Pokégear 3.0
14 Water Energy
4 Lightning Energy`,
  },
  {
    nome: "Deck da May", retrato: "may", era: "Hoenn",
    desc: "A coordenadora de Hoenn: Torchic até Blaziken, Skitty, Beautifly, Squirtle, Munchlax e Glaceon.",
    cartas: `
*4 Torchic
2 Combusken
*2 Blaziken
*2 Skitty
1 Delcatty
2 Wurmple
1 Silcoon
1 Beautifly
2 Squirtle
1 Wartortle
1 Munchlax
2 Eevee
1 Glaceon
4 Professor's Research
3 Rare Candy
3 Nest Ball
2 Poké Ball
2 Switch
2 Potion
2 Energy Retrieval
2 Pokégear 3.0
10 Fire Energy
3 Grass Energy
5 Water Energy`,
  },
  {
    nome: "Deck da Serena", retrato: "serena", era: "Kalos",
    desc: "A Performer de Kalos: Fennekin até Delphox, Eevee e Sylveon e o Pancham, com o apoiador Serena.",
    cartas: `
*4 Fennekin
2 Braixen
*2 Delphox
3 Eevee
*2 Sylveon
2 Pancham
1 Pangoro
1 Furfrou
4 Serena
3 Professor's Research
3 Rare Candy
4 Nest Ball
2 Ultra Ball
2 Switch
2 Super Rod
2 Energy Retrieval
1 Pokégear 3.0
12 Fire Energy
4 Fairy Energy
4 Fighting Energy`,
  },
  {
    nome: "Deck do Goh", retrato: "goh", era: "Galar (Jornadas)",
    desc: "O amigo do Ash em Jornadas: Cinderace, Inteleon, Golisopod, Suicune e o sonho de pegar o Mew.",
    cartas: `
*4 Scorbunny
2 Raboot
*2 Cinderace
3 Sobble
2 Drizzile
*2 Inteleon
2 Wimpod
1 Golisopod
1 Suicune
1 Mew
1 Galarian Farfetch'd
1 Galarian Sirfetch'd
4 Professor's Research
3 Rare Candy
3 Quick Ball
2 Nest Ball
2 Switch
1 Super Rod
2 Energy Retrieval
1 Boss's Orders
2 Pokégear 3.0
10 Fire Energy
8 Water Energy`,
  },
  {
    nome: "Deck da Liko", retrato: "liko", era: "Paldea (Horizontes)",
    desc: "A protagonista de Horizontes: Sprigatito até Meowscarada, Hattrem e o misterioso Terapagos.",
    cartas: `
*4 Sprigatito
2 Floragato
*2 Meowscarada
*2 Terapagos ex
2 Hatenna
1 Hattrem
1 Hatterene
4 Professor's Research
4 Nest Ball
3 Ultra Ball
3 Rare Candy
2 Switch
2 Super Rod
2 Energy Retrieval
2 Boss's Orders
2 Pokégear 3.0
2 Arven
12 Grass Energy
8 Psychic Energy`,
  },
  {
    nome: "Deck do Roy", retrato: "roy", era: "Paldea (Horizontes)",
    desc: "O outro protagonista de Horizontes: Fuecoco até Skeledirge, Wattrel e o Rayquaza que ele sonha encontrar.",
    cartas: `
*4 Fuecoco
2 Crocalor
*2 Skeledirge
2 Wattrel
1 Kilowattrel
*1 Rayquaza
2 Charcadet
1 Armarouge
4 Professor's Research
4 Nest Ball
3 Ultra Ball
3 Rare Candy
2 Switch
2 Super Rod
2 Energy Retrieval
2 Boss's Orders
2 Pokégear 3.0
2 Iono
14 Fire Energy
5 Lightning Energy`,
  },
  {
    nome: "Deck do Red", retrato: "red", era: "Kanto (jogos)",
    desc: "O campeão dos primeiros jogos: Pikachu, Charizard, Venusaur, Blastoise, Snorlax e Lapras, com o Desafio do Red.",
    cartas: `
*4 Pikachu
2 Charmander
1 Charmeleon
*1 Charizard
2 Bulbasaur
1 Ivysaur
*1 Venusaur
2 Squirtle
1 Wartortle
1 Blastoise
2 Snorlax
2 Lapras
2 Red's Challenge
4 Professor's Research
4 Rare Candy
3 Nest Ball
3 Ultra Ball
2 Switch
2 Potion
2 Energy Retrieval
2 Super Rod
6 Lightning Energy
4 Fire Energy
3 Grass Energy
3 Water Energy`,
  },
  {
    nome: "Deck da Cynthia", retrato: "cynthia", era: "Sinnoh",
    desc: "A campeã de Sinnoh: o Garchomp dela, Roserade, Spiritomb, Milotic e Lucario, com as cartas oficiais da Cynthia.",
    cartas: `
*4 Cynthia's Gible
3 Cynthia's Gabite
*3 Cynthia's Garchomp ex
2 Cynthia's Roselia
*2 Cynthia's Roserade
2 Cynthia's Spiritomb
2 Cynthia's Feebas
1 Cynthia's Milotic
2 Riolu
1 Lucario
4 Cynthia's Ambition
2 Cynthia's Power Weight
3 Rare Candy
4 Nest Ball
3 Ultra Ball
2 Switch
2 Super Rod
2 Boss's Orders
10 Fighting Energy
3 Grass Energy
3 Water Energy`,
  },
];
