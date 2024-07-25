# Instalação da API 📜
**1. É necessário instalar o nodejs e o npm. Caso não tenha essas bibliotecas, rodar o seguinte comando:**

```linux
apt-get install nodejs npm
```

**2. Verificar se foi instalado corretamente:**
- Node:
```linux
node --version
```
- npm:
```linux
npm --version
```
- git  (geralmente já está instalado, mas vale verificar):
```linux
git --version
```
Caso não esteja:
```linux
apt-get install git
```

**3. Criar, ou acessar a pasta para a API e clonar o repositório git:**

Atenção, pois ele vai criar uma pasta nova, então precisa acessar a pasta que foi criada pela clonagem para prosseguir
```git
git clone https://github.com/caiovidinha/API-MK-AUTH
```

**4. Acessar a pasta clonada e instalar as dependencias necessárias com o npm:**

Atenção, pois ele vai criar uma pasta nova, então precisa acessar a pasta que foi criada pela clonagem para prosseguir
```
npm install
```

**5. Configurar as variáveis de ambiente a partir do arquivo .env.example**
- Copiar o arquivo .env.example para .env
```
cp .env.example .env
```

- Preencher o .env com as informações:
```
CLIENT_ID=Client do mk-auth
CLIENT_SECRET=Secret do mk-auth
URL= url do mk-auth (ex.: https://192.168.100.193) *Sem barra no final e com https:// no começo mesmo*
```

**6. Colocar o servidor para rodar:**
- utilizar o pm2 e o apache para rodar a API (recomendado e funcional)



