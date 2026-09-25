import request from "supertest"
import app from "../../src/app.js"
import {prisma} from "../../src/config/prisma.js"
import jwt from "jsonwebtoken"
import {env} from "../../src/config/env.js"
// tests/sedes.test.js
import bcrypt from 'bcryptjs';

export async function crearUsuarioDeTest(rol = 'ADMIN' ) {
  const passwordHash = await bcrypt.hash('password123', 10);
  const sufijo = Date.now();

  return prisma.usuario.create({
    data: {
      nombre: 'Test',
      apellido: 'Usuario',
      email: `test-${sufijo}@test.com`,
      dni: `${sufijo}`.slice(-8), // dni suele ser numérico y de largo fijo, ajustá si tu validación lo exige
      passwordHash,
      rol,
    },
  });
}

function generarTokenDeTest(id, rol) {
  return jwt.sign({sub:id, rol:rol }, env.JWT_SECRET, { expiresIn: "1h" });
}

describe("POST /sedes", () => {
    afterEach(async () => {
        await prisma.usuario.deleteMany()
        await prisma.sede.deleteMany()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    it("Crear una sede", async () => {
        const usuario = await crearUsuarioDeTest('ADMIN');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(201);
        const enlaBase = await prisma.sede.findUnique({ where: { id: res.body.id } });
        expect(enlaBase).not.toBeNull();
        expect(enlaBase.nombre).toBe("Sede Centro");
        console.log(res.status)
    })

    it("Datos invalidos", async () => {
        const usuario = await crearUsuarioDeTest('ADMIN');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "name": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(400);
        console.log(res.status)
    })

    it("Usuario no autenticado", async () => {
        const usuario = await crearUsuarioDeTest('ADMIN');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        const res = await request(app)
            .post("/api/sedes")
            // .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(401);
        // console.log(res.status)
    })

    it("Usuario con token invalido", async () => {
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer token-no-valido`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(401);
        // console.log(res.status)
    })

    it("Usuario no autorizado", async () => {
        const usuario = await crearUsuarioDeTest('USUARIO');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(403);
        console.log(res.status, res.body);
    })

    it("Sede con mismo nombre en una misma ciudad", async () => {
        const usuario = await crearUsuarioDeTest('ADMIN');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        await prisma.sede.create({
            data:{
                nombre: "Sede Centro", 
                ciudad: "Cordoba", 
                provincia: "Cordoba", 
                direccion: "Av. Colon 1234", 
                telefono: "+54 351 4567890", 
                email: "centro@instituto.edu.ar"
            }
        })
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(409);
        console.log(res.status, res.body);
    })

    it("Sede con mismo nombre en distinta ciudad", async () => {
        const usuario = await crearUsuarioDeTest('ADMIN');
        const token = generarTokenDeTest(usuario.id, usuario.rol);
        await prisma.sede.create({
            data:{
                nombre: "Sede Centro", 
                ciudad: "Rosario", 
                provincia: "Santa Fe", 
                direccion: "Av. Colon 1234", 
                telefono: "+54 351 4567890", 
                email: "centro@instituto.edu.ar"
            }
        })
        const res = await request(app)
            .post("/api/sedes")
            .set("Authorization", `Bearer ${token}`)
            .send({ 
                    "nombre": "Sede Centro", 
                    "ciudad": "Cordoba", 
                    "provincia": "Cordoba", 
                    "direccion": "Av. Colon 1234", 
                    "telefono": "+54 351 4567890", 
                    "email": "centro@instituto.edu.ar"
                });
        
        expect(res.status).toBe(201);
        console.log(res.status, res.body);
    })

})