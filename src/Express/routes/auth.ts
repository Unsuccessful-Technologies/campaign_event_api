import {sign, verify} from 'jsonwebtoken'
import {NextFunction, Request, Response, Router} from "express";
import {CreateUser, GetUserByEmail, UserExists} from "../../Database";
import config from "../../config";
import {EventTokenPayload, CreateUserPayload, SuccessfulLoginResult, TokenPayload, UserDocInternal} from "../../interfaces";

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

const Join = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user: CreateUserPayload = req.body.user
        const { email } = user
        const userExists = await UserExists(email)
        if(userExists){
            res.status(200).json({success: false, message: "User already exists."})
        } else {
            const userDoc: UserDocInternal = await CreateUser(user)
            const {_id} = userDoc
            if(_id){
                // TODO Need to verify user through email
                res.status(200).json({success: true, message: "Please login. User was successfully created."})
            }
        }
    } catch (e) {
        console.log(e.message)
        res.status(500).json({
            message: e.message
        })
    }
}

const isAuthentic = (req: Request, res: Response, next: NextFunction) => {
    const token: string = req.headers['token'] as string
    try {
        if(!token){
            throw new Error('Not Authorized')
        } else {
            const payload = verify(token,config.secret)
            if(payload){
                req.headers.payload = JSON.stringify(payload)
                next()
            } else {
                throw new Error('Not Authorized')
            }
        }
    } catch(e){
        console.log(e.message)
        res.status(401).json({message:e.message})
    }
}

const GetToken = async (req: Request, res: Response, next: NextFunction) => {
    let { payload } = req.headers
    const payloadJSON: TokenPayload = JSON.parse(<string>payload)
    const {user_id} = payloadJSON
    const { event_id } = req.params
    try {
        const token = sign({user_id, event_id}, config.secret)
        res.status(200).json({token})
    } catch (e) {
        console.log(e.message)
        res.status(500).json({
            message: e.message
        })
    }
}

const Token = async (req: Request, res: Response, next: NextFunction) => {
    let { payload } = req.headers
    const payloadJSON: EventTokenPayload = JSON.parse(<string>payload)
    const {user_id, event_id} = payloadJSON
    const {event_id: event_id_param} = req.params
    try {
        if(event_id === event_id_param){
            // TODO Also check if the user is allowed to authorize access to event_id
            res.status(200).json({allowed:true})
        } else {
            res.status(200).json({allowed:false})
        }
    } catch (e) {
        console.log(e.message)
        res.status(500).json({
            message: "Server Error"
        })
    }
}




router.post("/login", Login)

router.post("/join", Join)

router.use(isAuthentic)

router.get("/token/:event_id", GetToken)

router.get("/token/valid/:event_id", Token)


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
        data: clean_user,
        token
    }
    return result
}