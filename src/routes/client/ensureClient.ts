
export const ensureClient = (req: any, res: any) => {
    const sessionUser = req.session?.user;
    if (!sessionUser || sessionUser.role !== "DOCTOR") {
        res.status(403).json({ error: "Acces interzis" });
        return null;
    }
    return sessionUser;
};