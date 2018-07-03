<?php

namespace podmail;

class Db
{
    protected $manager;

    public function __construct(array $config)
    {
        $this->manager = new \MongoDB\Driver\Manager('mongodb://' . $config['mongo']['server'] . ':' . $config['mongo']['port']);
        $this->namespace = $config['mongo']['db'];
    }

    public function exists(string $coll, array $filter = [], array $options = [])
    {
        $options['limit'] = 1;
        $cursor = $this->query($coll, $filter, $options);
        foreach ($cursor as $row) return true;
        return false;
    }

    public function count(string $coll, array $filter = [], array $options = [])
    {   
        $command = new \MongoDB\Driver\Command(['count' => $coll, 'query' => $filter]);
        $result = $this->manager->executeCommand($this->namespace, $command);
        foreach ($result as $row) return $row->n;
        return 0;
    }

    public function queryDoc(string $coll, array $filter = [], array $options = [])
    {
        $cursor = $this->query($coll, $filter, $options);
        foreach ($cursor as $row) return $row;
        return null;
    }

    public function query(string $coll, array $filter = [], array $options = [])
    {
        $query = new \MongoDB\Driver\Query($filter, $options);
        $cursor = $this->manager->executeQuery($this->namespace . "." . $coll, $query);
        $cursor->setTypeMap(['root' => 'array', 'document' => 'array', 'array' => 'array']);
        return $cursor->toArray();
    }

    public function insert(string $coll, array $data)
    {
        $bulk = new \MongoDB\Driver\BulkWrite();
        $bulk->insert($data);
        return $this->manager->executeBulkWrite($this->namespace . ".". $coll, $bulk)->getInsertedCount();
    }

    public function update(string $coll, array $filter = [], array $values, array $options = [])
    {
        $bulk = new \MongoDB\Driver\BulkWrite();
        $bulk->update($filter, $values, $options);
        return $this->manager->executeBulkWrite($this->namespace . ".". $coll, $bulk)->getUpsertedCount();
    }

    public function delete(string $coll, array $filter = [])
    {
        $bulk = new \MongoDB\Driver\BulkWrite();
        $bulk->delete($filter);
        return $this->manager->executeBulkWrite($this->namespace . ".". $coll, $bulk)->getDeletedCount();
    }
}
