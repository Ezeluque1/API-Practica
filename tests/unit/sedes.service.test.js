import {crear} from "../../src/services/sede.service.js"
import {prisma} from "../../src/config/prisma.js"

jest.mock("../../src/config/prisma.js", () => ({
  prisma: {
    sede: {
      create: jest.fn(),
      findUnique: jest.fn()
    }
  },
}))

describe("Crear (sede.service)", () => {

    afterEach(() => {
        jest.clearAllMocks();
    })

    it("Deberia crear una sede correctamente y devolverla", async () => {
        const datos = {ciudad: "Ciudad test", nombre:"Sede test"}
        const fakeSede = {id:"1", ...datos}

        prisma.sede.create.mockResolvedValue(fakeSede)

        const result = await crear(datos)

        expect(prisma.sede.create).toHaveBeenCalledWith({
            data:datos,
            select: expect.anything(),
        })

        expect(result).toEqual(fakeSede)

    })

    it("", async () => {
        const datos = {ciudad: "Ciudad test", nombre:"Sede test"}
        const fakeSede = {id:"1", ...datos}

        prisma.sede.create.mockResolvedValue(fakeSede)

        const result = await crear(datos)

        expect(prisma.sede.create).toHaveBeenCalledWith({
            data:datos,
            select: expect.anything(),
        })

        expect(result).toEqual(fakeSede)

    })

})


