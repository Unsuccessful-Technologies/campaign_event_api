import {sign} from 'jsonwebtoken'
import {NextFunction, Request, Response, Router} from "express";
import {GetUserByEmail} from "../../Database";
import config from "../../config";
import {SuccessfulLoginResult, TokenPayload, UserDocInternal} from "../../interfaces";

const router = Router()

const Login = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body
    const user: UserDocInternal = await GetUserByEmail(email)

    try {
        if(user){
            ComparePasswords(user, password)
            const result = CreateSuccessfulLoginResult(user)
            res.status(200).json(result)
        } else {
            throw new Error('User was not found')
        }
    } catch (e) {
        console.log(e.message)
        res.status(400).json({
            message: "Unauthorized"
        })
    }
}

router.post("/login", Login)

export default router

const ComparePasswords = (user: UserDocInternal, password: string): void => {
    const result = user.password === password
    if(!result){
        throw new Error("Passwords Did Not Match")
    }
}

const CreateSuccessfulLoginResult = (user: UserDocInternal): SuccessfulLoginResult => {
    const clean_user = {...user}
    delete clean_user._id
    delete clean_user.password
    const payload: TokenPayload = {user_id: user._id}
    console.log(payload)
    const token = sign(payload, config.secret)
    const result = {
        user: clean_user,
        token
    }
    return result
}