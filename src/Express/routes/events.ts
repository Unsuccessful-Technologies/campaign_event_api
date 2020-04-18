import {NextFunction, Request, Response, Router} from "express";
import {ObjectId} from 'bson'
import {BaseEvent, BaseEventRaw, EventType, NewEventBody, TokenPayload} from "../../interfaces";
import {verify} from "jsonwebtoken";
import config from "../../config";
import {CreateEvent, CreateOrganization, CreateUser} from "../../Database";

const router = Router()

const NewEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    const body: NewEventBody = req.body
    let user_id: ObjectId
    let organization_id: ObjectId
    try {
        if(body.token && !body.new_user){
            user_id = GetUserId(body.token)
        }
        if(!body.token && body.new_user){
            let new_user = await CreateUser({_id:user_id,...body.new_user})
            user_id = new ObjectId(new_user._id)
        }
        if(body.organization_id && !body.organization){
            organization_id = new ObjectId(body.organization_id)
        }
        if(!body.organization_id && body.organization){
            let new_organization = await CreateOrganization(body.organization)
            organization_id = new ObjectId(new_organization._id)
        }
        const base_event = MakeBaseEvent(user_id, organization_id, body.event)

        const result = await CreateEvent(base_event)
        res.status(200).json(result)
    } catch (e) {
        console.log(e.message)
        res.status(500).json(e)
    }
}

router.post("/", NewEventHandler)

export default router



const GetUserId = (token:string): ObjectId => {
    const token_payload: TokenPayload = <TokenPayload>verify(token, config.secret)
    if(token_payload){
        return new ObjectId(token_payload.user_id)
    } else {
        throw new Error('Token is invalid')
    }
}

const MakeBaseEvent = (user_id: ObjectId, organization_id: ObjectId, event: BaseEventRaw ): BaseEvent => {
    return {
        created_by_id: user_id,
        ...event,
        organization_id
    }
}