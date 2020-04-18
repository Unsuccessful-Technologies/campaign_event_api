
// Helper Functions

const GetArgVariables = () => {
    const Items = process.argv.slice(2)
    const result: { [propName:string] : string } = {}
    Items.forEach(item => {
        const [key,value] = item.trim().split("=")
        result[key] = value.toLowerCase()
    })
    return result
}


// Main Process

let { PORT, REDIS_HOST, REDIS_PORT, MONGO_USERNAME, MONGO_PASSWORD } = GetArgVariables()

MONGO_USERNAME = MONGO_USERNAME ? MONGO_USERNAME: "guest"
MONGO_PASSWORD = MONGO_PASSWORD ? MONGO_PASSWORD: "Password12"

const config = {
    public: `${__dirname}/public`,
    port: PORT || process.env.PORT || 8080,
    redis: {
        host: REDIS_HOST || 'localhost',
        port: REDIS_PORT || 6379
    },
    mongodb: {
        url: `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@development-4jc08.mongodb.net/?retryWrites=true&w=majority`,
        database_name: "CampaignEvents"
    },
    secret: "jwt_super_secret_password"
}

export default config
