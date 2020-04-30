const config = {
    port: process.env.PORT || 8080,
    mongodb: {
        url: `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@development-4jc08.mongodb.net/?retryWrites=true&w=majority`,
        database_name: process.env.MONGO_DATABASE
    },
    secret: process.env.SECRET
}

export default config
