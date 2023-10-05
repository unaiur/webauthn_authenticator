import { loadRepositories } from '../repos.js'
import { loadSettings } from '../settings.js';
import { withDir } from 'tmp-promise';


describe('Repositories', () => {
    const settings = loadSettings();
    const cwd = process.cwd();
    settings.dbSync = true;

    afterEach(() => {
        process.chdir(cwd);
    })

    test('it must create a new database if none exists', async () => {
        await withDir(async (path) => {
            process.chdir(path.path)

            const startDate = new Date();
            startDate.setMilliseconds(0);
            const repos = await loadRepositories(settings);

            expect(await repos.credentials.count()).toBe(0)
            expect(await repos.invitations.count()).toBe(1)
            expect(await repos.users.count()).toBe(1)
            expect(await repos.roles.count()).toBe(1)
            expect(await repos.rules.count()).toBe(1)

            const user = await repos.users.findOne({
                where: { name: "owner" },
                relations: { roles: true },
            })
            expect(user?.name).toBe("owner")
            expect(user?.displayName).toBe("Owner")
            expect(user?.createdOn.valueOf()).toBeGreaterThanOrEqual(startDate.valueOf())
            expect(user?.updatedOn.valueOf()).toBeGreaterThanOrEqual(startDate.valueOf())
            expect(user?.roles).toEqual([{value: "admin", display: "Administrator"}])

            await repos.dataSource.destroy();
        }, {unsafeCleanup: true})
    })

    test('it must not duplicate records if already initialized', async () => {
        await withDir(async (path) => {
            process.chdir(path.path)

            const repos1 = await loadRepositories(settings);
            await repos1.dataSource.destroy();

            const repos = await loadRepositories(settings);
            expect(await repos.credentials.count()).toBe(0)
            expect(await repos.invitations.count()).toBe(1)
            expect(await repos.users.count()).toBe(1)
            expect(await repos.roles.count()).toBe(1)
            expect(await repos.rules.count()).toBe(1)
        }, {unsafeCleanup: true});
    })
})