  
# GunPlus

GunPlus is a library that extends the functionality of the decentralized database system [Gun](https://gun.eco/) by providing convenience functions and wrapper functionality.

It is based on the princples from [this article](https://gustavcorpas.medium.com/a-beginners-guide-to-decentralized-database-programming-with-gundb-c009d77207ad).

## Features

- Define you database and get intellisense.
- Use streams for retrieving data.
- Extend gun nodes with common functionality.

## Installation

You can install GunPlus via npm:

`npm install gun-plus` 

## Usage

```js
// Import GunPlus
import GunPlus from "gun-plus"

// Instantiate the instance. GunPlus is a singleton.
new GunPlus({Gun, SEA}, "your-app-scope");

// Define you database nodes
class UserNode extends GunNode {
	//...
	name = () => GunNode(this.chain.get("name"));
}

// Use convenience functions and wrapper classes
const pair = await GunPlus.SEA.pair();
const user = await GunPlus.auth(pair, UserNode)
user.name.put("Alice");
```

# Initialization 

If you are using a fullstack framework like e.g. Svelte.js, importing Gun may accidentally lead to Gun running on the server side. This may not be what you want. The `GunPlus.imports` function will import gun at runtime, allowing you to do this only on the client side.

```js
// In the browser part of you framework (like onMount in +layout.svelte)
onMount(() => {
	GunPlus.imports().then( imports => new GunPlus(imports, "your-app-scope") );
})

```

## Documentation

For detailed documentation, please refer to the relevant `.md` file in the docs folder.

- [Authentication](./docs/authentication.md)

**Examples:**

---

Every GunNode can be read as a stream that supports async iterators. If the stream is cancelled, GunPlus will automatically unsubscribe the underlying .on gun call.

```js
// Reading as a stream.
for await (const {value, key, node} of user.groups.stream()) {
	if(value) console.log(node.name) // logs group name
}
```

---

You can define GunNodes that will carry the correct context when using map on them, by supplying the class in the *iterates* option.
```js
// Defining an array-like iterable
class UserNode extends GunNode {
	// ...
	get groups() { return new GunNode(this.chain.get("groups"), {iterates: GroupNode}) }
}
class GroupNode extends GunNode {
	get title() { return new GunNode(this.chain.get("name")) };
}

// Using it after getting a reference to a UserNode
user.groups.map().title.stream() // stream of all group titles.
```

---

You can wrap any node in whatever of your specified nodes you want by passing it to the `soul` function.

```js
const user = gp.soul(gp.user.pair({strict: true}).pub, UserNode);
user.groups().title // do something UserNode specific.

const group = gp.soul(group_public_key, GroupNode);
group.title // do something GroupNode specific.
```


## Contributing

We welcome contributions! If you'd like to contribute to GunPlus, please see our [Contribution Guidelines](./docs/CONTRIBUTING.md).

## License

GunPlus is licensed under the [MIT License](./LICENSE).